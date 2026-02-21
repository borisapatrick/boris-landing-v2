// Admin Dashboard Logic for Boris Enterprises
// Handles: admin verification, appointments management, customer list, filtering
// Called by auth.js via initAdminDashboard() and showAdminAccessDenied()

(function() {
  'use strict';

  // Store all appointments for client-side filtering
  var allAppointments = [];
  var currentFilter = 'all';

  // --- Utility Functions ---
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    var date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function formatDateShort(timestamp) {
    if (!timestamp) return 'N/A';
    var date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // --- Show Admin Access Denied ---
  // Called by auth.js when logged-in user is not an admin
  window.showAdminAccessDenied = function() {
    var loading = document.getElementById('adminLoading');
    var denied = document.getElementById('access-denied');
    var content = document.getElementById('admin-content');

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'none';
    if (denied) denied.style.display = 'flex';
  };

  // --- Initialize Admin Dashboard ---
  // Called by auth.js when user is verified as admin
  window.initAdminDashboard = function(user) {
    var loading = document.getElementById('adminLoading');
    var denied = document.getElementById('access-denied');
    var content = document.getElementById('admin-content');

    if (loading) loading.style.display = 'none';
    if (denied) denied.style.display = 'none';
    if (content) content.style.display = 'block';

    // Load data
    loadAppointments();
    loadCustomers();

    // Set up filter tabs
    initFilterTabs();
  };

  // --- Load Appointments ---
  function loadAppointments() {
    var container = document.getElementById('appointments-list');
    if (!container) return;

    db.collection('appointments')
      .orderBy('createdAt', 'desc')
      .get()
      .then(function(snapshot) {
        if (snapshot.empty) {
          allAppointments = [];
          updateStats();
          container.innerHTML = '<p class="empty-state">No appointments yet.</p>';
          return;
        }

        allAppointments = [];
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data._id = doc.id;
          allAppointments.push(data);
        });

        updateStats();
        renderAppointments();
      })
      .catch(function(error) {
        console.error('Error loading appointments:', error);
        container.innerHTML = '<p class="empty-state">Error loading appointments. Please try again.</p>';
      });
  }

  // --- Update Stats ---
  function updateStats() {
    var total = allAppointments.length;
    var pending = 0;
    var approved = 0;
    var denied = 0;

    for (var i = 0; i < allAppointments.length; i++) {
      var status = allAppointments[i].status || 'pending';
      if (status === 'pending') pending++;
      else if (status === 'approved') approved++;
      else if (status === 'denied') denied++;
    }

    var statTotal = document.getElementById('stat-total');
    var statPending = document.getElementById('stat-pending');
    var statApproved = document.getElementById('stat-approved');
    var statDenied = document.getElementById('stat-denied');

    if (statTotal) statTotal.textContent = total;
    if (statPending) statPending.textContent = pending;
    if (statApproved) statApproved.textContent = approved;
    if (statDenied) statDenied.textContent = denied;
  }

  // --- Render Appointments ---
  function renderAppointments() {
    var container = document.getElementById('appointments-list');
    if (!container) return;

    // Filter appointments based on current filter
    var filtered = allAppointments;
    if (currentFilter !== 'all') {
      filtered = allAppointments.filter(function(appt) {
        return (appt.status || 'pending') === currentFilter;
      });
    }

    if (filtered.length === 0) {
      var msg = currentFilter === 'all'
        ? 'No appointments yet.'
        : 'No ' + currentFilter + ' appointments.';
      container.innerHTML = '<p class="empty-state">' + escapeHtml(msg) + '</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      html += buildAppointmentCard(filtered[i]);
    }
    container.innerHTML = html;
  }

  // --- Build Appointment Card HTML ---
  function buildAppointmentCard(appt) {
    var id = appt._id;
    var status = appt.status || 'pending';
    var statusClass = '';
    if (status === 'pending') statusClass = 'status-pending';
    else if (status === 'approved') statusClass = 'status-approved';
    else if (status === 'denied') statusClass = 'status-denied';

    var customerName = appt.userName || 'Unknown';
    var customerEmail = appt.userEmail || '';
    var customerPhone = appt.userPhone || '';

    var vehicleStr = '';
    if (appt.vehicleYear || appt.vehicleMake || appt.vehicleModel) {
      vehicleStr = (appt.vehicleYear || '') + ' ' + (appt.vehicleMake || '') + ' ' + (appt.vehicleModel || '');
      vehicleStr = vehicleStr.trim();
      if (appt.licensePlate) {
        vehicleStr += ' (' + appt.licensePlate + ')';
      }
    }

    var preferredDate = appt.preferredDate || 'N/A';
    var message = appt.message || '';
    var submittedDate = formatTimestamp(appt.createdAt);

    var html = '';
    html += '<div class="admin-appt-card" id="appt-' + escapeHtml(id) + '">';
    html += '  <div class="appt-details">';
    html += '    <div class="appt-customer">' + escapeHtml(customerName) + '</div>';

    if (customerEmail) {
      html += '    <div class="appt-date">' + escapeHtml(customerEmail) + '</div>';
    }
    if (customerPhone) {
      html += '    <div class="appt-date">' + escapeHtml(customerPhone) + '</div>';
    }
    if (vehicleStr) {
      html += '    <div class="appt-vehicle">' + escapeHtml(vehicleStr) + '</div>';
    }

    html += '    <div class="appt-date">Preferred Date: ' + escapeHtml(preferredDate) + '</div>';

    // Show drop-off date/time for approved appointments
    if (status === 'approved' && (appt.dropoffDate || appt.dropoffTime)) {
      var dropoffStr = 'Drop-off: ' + (appt.dropoffDate || 'N/A');
      if (appt.dropoffTime) {
        dropoffStr += ' at ' + appt.dropoffTime;
      }
      html += '    <div class="appt-dropoff">' + escapeHtml(dropoffStr) + '</div>';
    }

    if (message) {
      html += '    <div class="appt-message">' + escapeHtml(message) + '</div>';
    }

    html += '    <div class="appt-date">Submitted: ' + escapeHtml(submittedDate) + '</div>';
    html += '    <div style="margin-top: 6px;"><span class="appointment-status ' + statusClass + '">' + escapeHtml(status) + '</span></div>';
    html += '  </div>';

    // Action buttons (only for pending appointments)
    html += '  <div class="appt-actions" id="appt-actions-' + escapeHtml(id) + '">';
    if (status === 'pending') {
      html += '    <button class="btn-approve" onclick="showApprovalForm(\'' + escapeHtml(id) + '\')">Approve</button>';
      html += '    <button class="btn-deny" onclick="denyAppointment(\'' + escapeHtml(id) + '\')">Deny</button>';
    }
    html += '  </div>';

    html += '</div>';
    return html;
  }

  // --- Show SMS Banner on Appointment Card ---
  // Displays a dismissible banner with the customer's phone and a pre-written
  // SMS message that can be copied to clipboard for pasting into Google Voice.
  function showSmsBanner(appointmentId, appointment, action) {
    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;

    // Remove any existing banner on this card first
    var existing = card.querySelector('.sms-banner');
    if (existing) existing.remove();

    var phone = appointment.userPhone || '';
    var vehicle = ((appointment.vehicleYear || '') + ' ' + (appointment.vehicleMake || '') + ' ' + (appointment.vehicleModel || '')).trim();

    var smsText = '';
    if (action === 'approved') {
      var dropoffInfo = '';
      if (appointment.dropoffDate) {
        dropoffInfo = ' Please drop off your vehicle on ' + appointment.dropoffDate;
        if (appointment.dropoffTime) {
          dropoffInfo += ' at ' + appointment.dropoffTime;
        }
        dropoffInfo += '.';
      } else {
        dropoffInfo = ' Date: ' + (appointment.preferredDate || 'ASAP') + '.';
      }
      smsText = 'Boris Enterprises: Great news! Your appointment for your '
        + vehicle
        + ' has been approved.' + dropoffInfo
        + ' Questions? Call us at 231-675-0723.';
    } else {
      smsText = 'Boris Enterprises: We were unable to accommodate your requested appointment for your '
        + vehicle
        + '. Please call us at 231-675-0723 to reschedule.';
    }

    var banner = document.createElement('div');
    banner.className = 'sms-banner';

    var bannerId = 'sms-msg-' + appointmentId;

    var html = '<div class="sms-banner-header">'
      + '<span class="sms-banner-title">TEXT CUSTOMER</span>'
      + '<button class="sms-banner-close" onclick="this.closest(\'.sms-banner\').remove()" title="Dismiss">&times;</button>'
      + '</div>';

    if (phone) {
      html += '<div class="sms-banner-phone">'
        + '<a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + '</a>'
        + '</div>';
    } else {
      html += '<div class="sms-banner-phone" style="color:#C62828;">No phone number on file</div>';
    }

    html += '<div class="sms-banner-message" id="' + bannerId + '">' + escapeHtml(smsText) + '</div>';
    html += '<button class="sms-banner-copy" onclick="copySmsMessage(\'' + bannerId + '\', this)">Copy Message</button>';

    banner.innerHTML = html;
    card.appendChild(banner);
  }

  // --- Copy SMS Message to Clipboard ---
  window.copySmsMessage = function(messageElementId, btn) {
    var el = document.getElementById(messageElementId);
    if (!el) return;
    var text = el.textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        btn.textContent = 'Copied!';
        btn.classList.add('sms-banner-copy-success');
        setTimeout(function() {
          btn.textContent = 'Copy Message';
          btn.classList.remove('sms-banner-copy-success');
        }, 2000);
      }).catch(function() {
        fallbackCopy(text, btn);
      });
    } else {
      fallbackCopy(text, btn);
    }
  };

  function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      btn.textContent = 'Copied!';
      btn.classList.add('sms-banner-copy-success');
      setTimeout(function() {
        btn.textContent = 'Copy Message';
        btn.classList.remove('sms-banner-copy-success');
      }, 2000);
    } catch (e) {
      btn.textContent = 'Copy failed';
      setTimeout(function() { btn.textContent = 'Copy Message'; }, 2000);
    }
    document.body.removeChild(ta);
  }

  // --- Show Inline Approval Form (Drop-off Scheduling) ---
  window.showApprovalForm = function(appointmentId) {
    // Find the appointment data for pre-filling
    var appointment = null;
    for (var i = 0; i < allAppointments.length; i++) {
      if (allAppointments[i]._id === appointmentId) {
        appointment = allAppointments[i];
        break;
      }
    }

    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;

    // Remove any existing approval form on this card
    var existingForm = card.querySelector('.approval-form');
    if (existingForm) existingForm.remove();

    // Pre-fill date from customer's preferred date (try to parse into YYYY-MM-DD for date input)
    var prefillDate = '';
    if (appointment && appointment.preferredDate) {
      var parsed = new Date(appointment.preferredDate);
      if (!isNaN(parsed.getTime())) {
        var yyyy = parsed.getFullYear();
        var mm = String(parsed.getMonth() + 1).padStart(2, '0');
        var dd = String(parsed.getDate()).padStart(2, '0');
        prefillDate = yyyy + '-' + mm + '-' + dd;
      }
    }

    var formHtml = '<div class="approval-form-title">Schedule Drop-off</div>'
      + '<div class="approval-form-row">'
      + '  <div class="approval-form-field">'
      + '    <label for="dropoff-date-' + escapeHtml(appointmentId) + '">Drop-off Date</label>'
      + '    <input type="date" id="dropoff-date-' + escapeHtml(appointmentId) + '" value="' + prefillDate + '">'
      + '  </div>'
      + '  <div class="approval-form-field">'
      + '    <label for="dropoff-time-' + escapeHtml(appointmentId) + '">Drop-off Time</label>'
      + '    <input type="time" id="dropoff-time-' + escapeHtml(appointmentId) + '" value="09:00">'
      + '  </div>'
      + '</div>'
      + '<div class="approval-form-actions">'
      + '  <button class="btn-confirm-approve" onclick="confirmApproval(\'' + escapeHtml(appointmentId) + '\')">Confirm Approval</button>'
      + '  <button class="approval-form-cancel" onclick="cancelApprovalForm(\'' + escapeHtml(appointmentId) + '\')">Cancel</button>'
      + '</div>';

    var formEl = document.createElement('div');
    formEl.className = 'approval-form';
    formEl.innerHTML = formHtml;
    card.appendChild(formEl);
  };

  // --- Cancel / Dismiss Approval Form ---
  window.cancelApprovalForm = function(appointmentId) {
    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;
    var form = card.querySelector('.approval-form');
    if (form) form.remove();
  };

  // --- Confirm Approval with Drop-off Date/Time ---
  window.confirmApproval = function(appointmentId) {
    var dateInput = document.getElementById('dropoff-date-' + appointmentId);
    var timeInput = document.getElementById('dropoff-time-' + appointmentId);

    var dropoffDate = dateInput ? dateInput.value : '';
    var dropoffTime = timeInput ? timeInput.value : '';

    // Format the time for display (e.g., "9:00 AM")
    var dropoffTimeDisplay = '';
    if (dropoffTime) {
      var parts = dropoffTime.split(':');
      var hours = parseInt(parts[0], 10);
      var minutes = parts[1];
      var ampm = hours >= 12 ? 'PM' : 'AM';
      var displayHours = hours % 12;
      if (displayHours === 0) displayHours = 12;
      dropoffTimeDisplay = displayHours + ':' + minutes + ' ' + ampm;
    }

    // Format the date for display (e.g., "Feb 21, 2026")
    var dropoffDateDisplay = '';
    if (dropoffDate) {
      var d = new Date(dropoffDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        dropoffDateDisplay = d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } else {
        dropoffDateDisplay = dropoffDate;
      }
    }

    // Disable the confirm button to prevent double-clicks
    var card = document.getElementById('appt-' + appointmentId);
    var confirmBtn = card ? card.querySelector('.btn-confirm-approve') : null;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Approving...';
    }

    approveAppointment(appointmentId, dropoffDate, dropoffDateDisplay, dropoffTime, dropoffTimeDisplay);
  };

  // --- Approve Appointment ---
  window.approveAppointment = function(appointmentId, dropoffDate, dropoffDateDisplay, dropoffTime, dropoffTimeDisplay) {
    var updateData = {
      status: 'approved',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (dropoffDate) updateData.dropoffDate = dropoffDate;
    if (dropoffTime) updateData.dropoffTime = dropoffTimeDisplay || dropoffTime;

    db.collection('appointments').doc(appointmentId).update(updateData).then(function() {
      // Update local data and find the appointment object
      var appointment = null;
      for (var i = 0; i < allAppointments.length; i++) {
        if (allAppointments[i]._id === appointmentId) {
          allAppointments[i].status = 'approved';
          if (dropoffDate) allAppointments[i].dropoffDate = dropoffDateDisplay || dropoffDate;
          if (dropoffTime) allAppointments[i].dropoffTime = dropoffTimeDisplay || dropoffTime;
          appointment = allAppointments[i];
          break;
        }
      }
      updateStats();
      refreshAppointmentCard(appointmentId, 'approved');

      // Send email notification (fire-and-forget)
      if (appointment && appointment.userEmail) {
        try {
          // Build drop-off line for email
          var emailDropoff = '';
          if (appointment.dropoffDate) {
            emailDropoff = '<p style="font-family: Arial, sans-serif;"><strong>Drop-off Date:</strong> ' + escapeHtml(appointment.dropoffDate);
            if (appointment.dropoffTime) {
              emailDropoff += ' at <strong>' + escapeHtml(appointment.dropoffTime) + '</strong>';
            }
            emailDropoff += '</p>';
          } else {
            emailDropoff = '<p style="font-family: Arial, sans-serif;"><strong>Date:</strong> ' + escapeHtml(appointment.preferredDate || 'ASAP') + '</p>';
          }

          db.collection('mail').add({
            to: appointment.userEmail,
            message: {
              subject: 'Appointment Approved — Boris Enterprises',
              html: '<h2 style="color: #CC1A1A; font-family: Arial, sans-serif;">Boris Enterprises</h2>'
                + '<p style="font-family: Arial, sans-serif;">Hi ' + escapeHtml(appointment.userName) + ',</p>'
                + '<p style="font-family: Arial, sans-serif;">Great news! Your appointment for your <strong>'
                + escapeHtml(appointment.vehicleYear) + ' ' + escapeHtml(appointment.vehicleMake) + ' ' + escapeHtml(appointment.vehicleModel)
                + '</strong> has been <strong style="color: green;">approved</strong>.</p>'
                + emailDropoff
                + '<p style="font-family: Arial, sans-serif;">If you need to reschedule or have questions, give us a call at <strong>231-675-0723</strong>.</p>'
                + '<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">'
                + '<p style="font-family: Arial, sans-serif; color: #888; font-size: 12px;">Boris Enterprises<br>9890 Whitfield Rd, East Jordan, MI 49727<br>231-675-0723</p>'
            }
          });
        } catch (emailError) {
          console.error('Error sending approval email:', emailError);
        }
      }

      // SMS DISABLED — Uncomment to re-enable once Twilio verification is complete
      /*
      // Send SMS notification (fire-and-forget via Cloud Function)
      if (appointment && appointment.userPhone) {
        try {
          var smsDropoff = '';
          if (appointment.dropoffDate) {
            smsDropoff = ' Please drop off your vehicle on ' + appointment.dropoffDate;
            if (appointment.dropoffTime) smsDropoff += ' at ' + appointment.dropoffTime;
            smsDropoff += '.';
          } else {
            smsDropoff = ' Date: ' + (appointment.preferredDate || 'ASAP') + '.';
          }
          db.collection('sms').add({
            to: appointment.userPhone,
            body: 'Boris Enterprises: Great news! Your appointment for your '
              + (appointment.vehicleYear || '') + ' ' + (appointment.vehicleMake || '') + ' ' + (appointment.vehicleModel || '')
              + ' has been approved.' + smsDropoff
              + ' Questions? Call 231-675-0723.'
          });
        } catch (smsError) {
          console.error('Error sending approval SMS:', smsError);
        }
      }
      */

      // Show SMS copy banner so admin can paste into Google Voice
      if (appointment) {
        showSmsBanner(appointmentId, appointment, 'approved');
      }
    }).catch(function(error) {
      console.error('Error approving appointment:', error);
      alert('Error approving appointment. Please try again.');
    });
  };

  // --- Deny Appointment ---
  window.denyAppointment = function(appointmentId) {
    db.collection('appointments').doc(appointmentId).update({
      status: 'denied',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
      // Update local data and find the appointment object
      var appointment = null;
      for (var i = 0; i < allAppointments.length; i++) {
        if (allAppointments[i]._id === appointmentId) {
          allAppointments[i].status = 'denied';
          appointment = allAppointments[i];
          break;
        }
      }
      updateStats();
      refreshAppointmentCard(appointmentId, 'denied');

      // Send email notification (fire-and-forget)
      if (appointment && appointment.userEmail) {
        try {
          db.collection('mail').add({
            to: appointment.userEmail,
            message: {
              subject: 'Appointment Update — Boris Enterprises',
              html: '<h2 style="color: #CC1A1A; font-family: Arial, sans-serif;">Boris Enterprises</h2>'
                + '<p style="font-family: Arial, sans-serif;">Hi ' + escapeHtml(appointment.userName) + ',</p>'
                + '<p style="font-family: Arial, sans-serif;">Unfortunately, we are unable to accommodate your requested appointment for your <strong>'
                + escapeHtml(appointment.vehicleYear) + ' ' + escapeHtml(appointment.vehicleMake) + ' ' + escapeHtml(appointment.vehicleModel)
                + '</strong> at this time.</p>'
                + '<p style="font-family: Arial, sans-serif;">Please give us a call at <strong>231-675-0723</strong> and we will find a time that works.</p>'
                + '<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">'
                + '<p style="font-family: Arial, sans-serif; color: #888; font-size: 12px;">Boris Enterprises<br>9890 Whitfield Rd, East Jordan, MI 49727<br>231-675-0723</p>'
            }
          });
        } catch (emailError) {
          console.error('Error sending denial email:', emailError);
        }
      }

      // SMS DISABLED — Uncomment to re-enable once Twilio verification is complete
      /*
      // Send SMS notification (fire-and-forget via Cloud Function)
      if (appointment && appointment.userPhone) {
        try {
          db.collection('sms').add({
            to: appointment.userPhone,
            body: 'Boris Enterprises: Unfortunately, we are unable to accommodate your requested appointment for your '
              + (appointment.vehicleYear || '') + ' ' + (appointment.vehicleMake || '') + ' ' + (appointment.vehicleModel || '')
              + ' at this time. Please call 231-675-0723 to reschedule.'
          });
        } catch (smsError) {
          console.error('Error sending denial SMS:', smsError);
        }
      }
      */

      // Show SMS copy banner so admin can paste into Google Voice
      if (appointment) {
        showSmsBanner(appointmentId, appointment, 'denied');
      }
    }).catch(function(error) {
      console.error('Error denying appointment:', error);
      alert('Error denying appointment. Please try again.');
    });
  };

  // --- Refresh a Single Appointment Card After Status Change ---
  function refreshAppointmentCard(appointmentId, newStatus) {
    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;

    // Remove inline approval form if present
    var approvalForm = card.querySelector('.approval-form');
    if (approvalForm) approvalForm.remove();

    // Update the status badge
    var statusBadge = card.querySelector('.appointment-status');
    if (statusBadge) {
      statusBadge.className = 'appointment-status status-' + newStatus;
      statusBadge.textContent = newStatus;
    }

    // Show drop-off info for approved appointments
    if (newStatus === 'approved') {
      var appointment = null;
      for (var i = 0; i < allAppointments.length; i++) {
        if (allAppointments[i]._id === appointmentId) {
          appointment = allAppointments[i];
          break;
        }
      }
      if (appointment && (appointment.dropoffDate || appointment.dropoffTime)) {
        // Insert drop-off line into the details area (before the message or submitted line)
        var existingDropoff = card.querySelector('.appt-dropoff');
        if (!existingDropoff) {
          var detailsDiv = card.querySelector('.appt-details');
          if (detailsDiv) {
            var dropoffStr = 'Drop-off: ' + (appointment.dropoffDate || 'N/A');
            if (appointment.dropoffTime) {
              dropoffStr += ' at ' + appointment.dropoffTime;
            }
            var dropoffEl = document.createElement('div');
            dropoffEl.className = 'appt-dropoff';
            dropoffEl.textContent = dropoffStr;
            // Insert after the preferred date line
            var prefDateEl = null;
            var dateEls = detailsDiv.querySelectorAll('.appt-date');
            for (var j = 0; j < dateEls.length; j++) {
              if (dateEls[j].textContent.indexOf('Preferred Date') !== -1) {
                prefDateEl = dateEls[j];
                break;
              }
            }
            if (prefDateEl && prefDateEl.nextSibling) {
              detailsDiv.insertBefore(dropoffEl, prefDateEl.nextSibling);
            } else {
              detailsDiv.appendChild(dropoffEl);
            }
          }
        }
      }
    }

    // Remove action buttons
    var actionsContainer = document.getElementById('appt-actions-' + appointmentId);
    if (actionsContainer) {
      actionsContainer.innerHTML = '';
    }

    // If current filter doesn't match new status, re-render
    if (currentFilter !== 'all' && currentFilter !== newStatus) {
      renderAppointments();
    }
  }

  // --- Filter Tabs ---
  function initFilterTabs() {
    var tabs = document.querySelectorAll('.filter-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function() {
        var filter = this.getAttribute('data-filter');

        // Update active tab
        var allTabs = document.querySelectorAll('.filter-tab');
        for (var j = 0; j < allTabs.length; j++) {
          allTabs[j].classList.remove('active');
        }
        this.classList.add('active');

        // Apply filter
        currentFilter = filter;
        renderAppointments();
      });
    }
  }

  // --- Load Customers ---
  function loadCustomers() {
    var container = document.getElementById('customers-list');
    if (!container) return;

    db.collection('users')
      .get()
      .then(function(snapshot) {
        if (snapshot.empty) {
          container.innerHTML = '<p class="empty-state">No customers yet.</p>';
          return;
        }

        var html = '';
        snapshot.forEach(function(doc) {
          var c = doc.data();
          var memberSince = formatDateShort(c.createdAt);

          html += '<div class="admin-customer-card">';
          html += '  <div class="customer-info">';
          html += '    <span class="customer-name">' + escapeHtml(c.name || 'Unknown') + '</span>';
          html += '    <span class="customer-email">' + escapeHtml(c.email || '') + '</span>';
          if (c.phone) {
            html += '    <span class="customer-phone">' + escapeHtml(c.phone) + '</span>';
          }
          html += '  </div>';
          html += '  <div class="customer-meta" style="text-align: right; font-size: 0.8rem; color: #999;">';
          html += '    Member since ' + escapeHtml(memberSince);
          html += '  </div>';
          html += '</div>';
        });
        container.innerHTML = html;
      })
      .catch(function(error) {
        console.error('Error loading customers:', error);
        container.innerHTML = '<p class="empty-state">Error loading customers. Please try again.</p>';
      });
  }

})();
