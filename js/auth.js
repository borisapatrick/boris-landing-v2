// Auth State Management for Boris Enterprises
// Handles: auth state listener, navbar updates, signup, login, logout, password reset, dashboard protection, admin check

(function() {
  'use strict';

  // Wait for Firebase to be ready
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
    return;
  }

  // Flag to prevent auth state listener from redirecting during active signup/login
  // The handleSignup/handleLogin functions will handle their own redirects
  window._authActionInProgress = false;

  // Admin status flag
  window._isAdmin = false;

  // --- Admin Check ---
  function checkAdminStatus(user) {
    if (!user) {
      window._isAdmin = false;
      return Promise.resolve(false);
    }
    return db.collection('admins').doc(user.uid).get().then(function(doc) {
      window._isAdmin = doc.exists;
      return doc.exists;
    }).catch(function(error) {
      console.error('Error checking admin status:', error);
      window._isAdmin = false;
      return false;
    });
  }

  // --- Auth State Listener & Navbar Update ---
  auth.onAuthStateChanged(function(user) {
    // Check admin status first, then update navbar and handle page logic
    checkAdminStatus(user).then(function(isAdmin) {
      updateNavbar(user, isAdmin);

      // If on dashboard page and not logged in, redirect to login
      if (!user && isDashboardPage()) {
        window.location.href = 'login.html';
        return;
      }

      // If on admin page and not logged in, redirect to login
      if (!user && isAdminPage()) {
        window.location.href = 'login.html';
        return;
      }

      // If on admin page and logged in but NOT admin, show access denied
      if (user && isAdminPage() && !isAdmin) {
        if (typeof window.showAdminAccessDenied === 'function') {
          window.showAdminAccessDenied();
        } else {
          alert('Access Denied: You do not have admin privileges.');
          window.location.href = 'dashboard.html';
        }
        return;
      }

      // If on admin page and IS admin, initialize admin dashboard
      if (user && isAdminPage() && isAdmin && typeof window.initAdminDashboard === 'function') {
        window.initAdminDashboard(user);
      }

      // If on login page and already logged in, redirect to dashboard
      // But skip if a signup/login action is in progress (let the action handle its own redirect)
      if (user && isLoginPage()) {
        if (window._authActionInProgress) {
          console.log('[AuthState] On login page, user signed in, but _authActionInProgress is true — skipping redirect (sign-in handler will redirect).');
        } else {
          console.log('[AuthState] On login page, user signed in, no action in progress — redirecting to dashboard.');
          window.location.href = 'dashboard.html';
        }
        return;
      }

      // If on dashboard page and logged in, initialize dashboard
      if (user && isDashboardPage() && typeof initDashboard === 'function') {
        initDashboard(user);
      }

      // If on index page and logged in, pre-fill contact form
      if (user && isIndexPage()) {
        prefillContactForm(user);
      }
    });
  });

  function isDashboardPage() {
    return window.location.pathname.endsWith('dashboard.html');
  }

  function isLoginPage() {
    return window.location.pathname.endsWith('login.html');
  }

  function isAdminPage() {
    return window.location.pathname.endsWith('admin.html');
  }

  function isIndexPage() {
    var path = window.location.pathname;
    return path.endsWith('index.html') || path.endsWith('/') || path === '';
  }

  // --- Update Navbar on All Pages ---
  function updateNavbar(user, isAdmin) {
    var navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Remove existing auth nav item if present
    var existingAuthLink = document.getElementById('nav-auth-item');
    if (existingAuthLink) {
      existingAuthLink.remove();
    }

    // Remove existing admin nav item if present
    var existingAdminLink = document.getElementById('nav-admin-item');
    if (existingAdminLink) {
      existingAdminLink.remove();
    }

    // Create auth nav item
    var li = document.createElement('li');
    li.id = 'nav-auth-item';

    var a = document.createElement('a');

    if (user) {
      a.href = 'dashboard.html';
      a.textContent = 'My Account';
      // Highlight if on dashboard page
      if (isDashboardPage()) {
        a.classList.add('nav-active');
      }
    } else {
      a.href = 'login.html';
      a.textContent = 'Login';
      // Highlight if on login page
      if (isLoginPage()) {
        a.classList.add('nav-active');
      }
    }

    li.appendChild(a);

    // Insert before the CTA phone button (last li)
    var ctaItem = navLinks.querySelector('.nav-cta');
    if (ctaItem && ctaItem.parentElement) {
      navLinks.insertBefore(li, ctaItem.parentElement);
    } else {
      navLinks.appendChild(li);
    }

    // Re-attach mobile nav close behavior to the new link
    a.addEventListener('click', function() {
      var navToggle = document.querySelector('.nav-toggle');
      var navLinksEl = document.querySelector('.nav-links');
      if (navToggle && navLinksEl) {
        navToggle.classList.remove('active');
        navLinksEl.classList.remove('active');
      }
    });

    // If admin, add Admin link (but only if one doesn't already exist in the markup)
    if (user && isAdmin) {
      var existingAdminLink = navLinks.querySelector('a[href="admin.html"]');
      if (!existingAdminLink) {
        var adminLi = document.createElement('li');
        adminLi.id = 'nav-admin-item';

        var adminA = document.createElement('a');
        adminA.href = 'admin.html';
        adminA.textContent = 'Admin';
        if (isAdminPage()) {
          adminA.classList.add('nav-active');
        }

        adminLi.appendChild(adminA);

        // Insert admin link before auth link
        navLinks.insertBefore(adminLi, li);

        // Re-attach mobile nav close behavior to the admin link
        adminA.addEventListener('click', function() {
          var navToggle = document.querySelector('.nav-toggle');
          var navLinksEl = document.querySelector('.nav-links');
          if (navToggle && navLinksEl) {
            navToggle.classList.remove('active');
            navLinksEl.classList.remove('active');
          }
        });
      }
    }
  }

  // --- Signup ---
  window.handleSignup = function(email, password, name, phone, smsConsent) {
    window._authActionInProgress = true;
    return auth.createUserWithEmailAndPassword(email, password)
      .then(function(userCredential) {
        var user = userCredential.user;
        // Update display name
        return user.updateProfile({ displayName: name }).then(function() {
          // Save profile to Firestore
          return db.collection('users').doc(user.uid).set({
            name: name,
            phone: phone,
            email: email,
            smsConsent: !!smsConsent,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
      })
      .then(function() {
        window._authActionInProgress = false;
      })
      .catch(function(error) {
        window._authActionInProgress = false;
        throw error;
      });
  };

  // --- Login ---
  window.handleLogin = function(email, password) {
    window._authActionInProgress = true;
    return auth.signInWithEmailAndPassword(email, password)
      .then(function(userCredential) {
        window._authActionInProgress = false;
        return userCredential;
      })
      .catch(function(error) {
        window._authActionInProgress = false;
        throw error;
      });
  };

  // --- Logout ---
  window.handleLogout = function() {
    return auth.signOut().then(function() {
      window.location.href = 'index.html';
    });
  };

  // --- Google Sign-In ---
  // Helper: create the Firestore user doc, with one automatic retry on failure.
  // Returns a promise that resolves when the doc is written (or rejects after retry).
  function createUserDoc(uid, userData) {
    console.log('[Google Sign-In] Writing user doc for UID:', uid);
    return db.collection('users').doc(uid).set(userData)
      .then(function() {
        console.log('[Google Sign-In] Firestore doc created successfully.');
      })
      .catch(function(err) {
        console.error('[Google Sign-In] .set() failed:', err.code, err.message, err);
        console.log('[Google Sign-In] Retrying .set() after 1 s...');
        return new Promise(function(resolve) { setTimeout(resolve, 1000); })
          .then(function() {
            return db.collection('users').doc(uid).set(userData);
          })
          .then(function() {
            console.log('[Google Sign-In] Firestore doc created on retry.');
          });
        // If the retry also fails the error propagates to the caller
      });
  }

  window.signInWithGoogle = function() {
    window._authActionInProgress = true;
    var provider = new firebase.auth.GoogleAuthProvider();

    console.log('[Google Sign-In] Starting signInWithPopup...');

    auth.signInWithPopup(provider)
      .then(function(result) {
        var user = result.user;
        console.log('[Google Sign-In] Popup succeeded. UID:', user.uid, 'Email:', user.email);

        // Force-refresh the ID token so that Firestore security rules see a
        // valid request.auth immediately. Without this, the very first
        // Firestore write after a brand-new Google sign-in can fail with a
        // "Missing or insufficient permissions" error because the Firestore
        // client has not yet picked up the new auth credential.
        console.log('[Google Sign-In] Refreshing ID token...');
        return user.getIdToken(true).then(function() {
          console.log('[Google Sign-In] Token refreshed. Checking Firestore doc...');

          // additionalUserInfo.isNewUser is unreliable (deprecated by Google/Firebase
          // as of Sept 2023 and may always return false). Instead, check whether the
          // Firestore users document already exists to decide if this is a new user.
          return db.collection('users').doc(user.uid).get();
        }).then(function(doc) {
          console.log('[Google Sign-In] Doc exists?', doc.exists);

          if (!doc.exists) {
            // New user — create their Firestore profile
            var smsConsent = !!window._signupConsent;
            var userData = {
              name: user.displayName || '',
              email: user.email || '',
              phone: '',
              smsConsent: smsConsent,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            console.log('[Google Sign-In] New user detected. Creating doc...');
            return createUserDoc(user.uid, userData).then(function() {
              console.log('[Google Sign-In] Doc write complete. Redirecting...');
              window._authActionInProgress = false;
              window.location.href = 'dashboard.html';
            }).catch(function(writeErr) {
              // Both attempts failed — still redirect so user is not stuck
              console.error('[Google Sign-In] Could not create user doc after retry:', writeErr);
              window._authActionInProgress = false;
              if (typeof showMessage === 'function') {
                showMessage('Account created but profile save failed. Please update your profile on the dashboard.', true);
              }
              setTimeout(function() { window.location.href = 'dashboard.html'; }, 2000);
            });
          } else {
            // Existing user — just redirect
            console.log('[Google Sign-In] Existing user. Redirecting...');
            window._authActionInProgress = false;
            window.location.href = 'dashboard.html';
          }
        });
      })
      .catch(function(error) {
        window._authActionInProgress = false;
        console.error('[Google Sign-In] Error:', error.code, error.message, error);
        if (typeof showMessage === 'function') {
          showMessage(
            typeof getFirebaseErrorMessage === 'function'
              ? getFirebaseErrorMessage(error.code)
              : 'Google sign-in failed. Please try again.',
            true
          );
        }
      });
  };

  // --- Password Reset ---
  window.handlePasswordReset = function(email) {
    return auth.sendPasswordResetEmail(email);
  };

  // --- Get Current User ---
  window.getCurrentUser = function() {
    return auth.currentUser;
  };

  // --- Pre-fill Contact Form for Logged-in Users ---
  function prefillContactForm(user) {
    var nameField = document.getElementById('name');
    var phoneField = document.getElementById('phone');

    if (!nameField) return;

    // Get user profile from Firestore
    db.collection('users').doc(user.uid).get().then(function(doc) {
      if (doc.exists) {
        var data = doc.data();
        if (nameField && !nameField.value && data.name) {
          nameField.value = data.name;
        }
        if (phoneField && !phoneField.value && data.phone) {
          phoneField.value = data.phone;
        }

        // Hide consent checkbox if user already consented
        if (data.smsConsent === true) {
          var consentCheckbox = document.getElementById('sms-consent');
          var consentGroup = consentCheckbox ? consentCheckbox.closest('.consent-group') : null;
          if (consentGroup) {
            consentGroup.style.display = 'none';
          }
          if (consentCheckbox) {
            consentCheckbox.checked = true;
          }
        }

        // Pre-fill with first saved vehicle if available
        db.collection('users').doc(user.uid).collection('vehicles').limit(1).get()
          .then(function(snapshot) {
            if (!snapshot.empty) {
              var vehicle = snapshot.docs[0].data();
              var yearField = document.getElementById('year');
              var makeField = document.getElementById('make');
              var modelField = document.getElementById('model');
              var plateField = document.getElementById('license-plate');

              if (yearField && !yearField.value && vehicle.year) yearField.value = vehicle.year;
              if (makeField && !makeField.value && vehicle.make) makeField.value = vehicle.make;
              if (modelField && !modelField.value && vehicle.model) modelField.value = vehicle.model;
              if (plateField && !plateField.value && vehicle.licensePlate) plateField.value = vehicle.licensePlate;
            }
          });
      }
    }).catch(function(error) {
      console.error('Error pre-filling form:', error);
    });
  }

  // --- Save Appointment to Firestore (logged-in users) ---
  // Uses top-level 'appointments' collection so admins can query all appointments
  window.saveAppointmentToFirestore = function(formData) {
    var user = auth.currentUser;
    if (!user) return Promise.reject(new Error('User not logged in'));

    // Get user profile data for denormalized storage
    return db.collection('users').doc(user.uid).get().then(function(doc) {
      var userData = doc.exists ? doc.data() : {};
      return db.collection('appointments').add({
        userId: user.uid,
        userName: userData.name || user.displayName || '',
        userPhone: userData.phone || '',
        userEmail: userData.email || user.email || '',
        vehicleYear: formData.year || '',
        vehicleMake: formData.make || '',
        vehicleModel: formData.model || '',
        licensePlate: formData.licensePlate || '',
        preferredDate: formData.preferredDate || 'ASAP',
        message: formData.message || '',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  };

  // --- Save Guest Appointment to Firestore (not logged in) ---
  // Uses 'guest_appointments' collection — no userId, just contact info
  window.saveGuestAppointmentToFirestore = function(formData) {
    return db.collection('guest_appointments').add({
      name: formData.name || '',
      phone: formData.phone || '',
      vehicleYear: formData.year || '',
      vehicleMake: formData.make || '',
      vehicleModel: formData.model || '',
      licensePlate: formData.licensePlate || '',
      preferredDate: formData.preferredDate || 'ASAP',
      message: formData.message || '',
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

})();
