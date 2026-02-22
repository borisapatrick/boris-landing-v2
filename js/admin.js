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
    return div.innerHTML.replace(/'/g, '&#39;');
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

  // --- Phone Formatting for Admin Forms ---
  window.formatAdminPhone = function(input) {
    var digits = input.value.replace(/\D/g, '');
    if (digits.length <= 3) {
      input.value = digits.length ? '(' + digits : '';
    } else if (digits.length <= 6) {
      input.value = '(' + digits.substring(0,3) + ') ' + digits.substring(3);
    } else {
      input.value = '(' + digits.substring(0,3) + ') ' + digits.substring(3,6) + '-' + digits.substring(6,10);
    }
  };

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

    // Action buttons
    html += '  <div class="appt-actions" id="appt-actions-' + escapeHtml(id) + '">';
    if (status === 'pending') {
      html += '    <button class="btn-approve" onclick="showApprovalForm(\'' + escapeHtml(id) + '\')">Approve</button>';
      html += '    <button class="btn-deny" onclick="showDenyConfirm(\'' + escapeHtml(id) + '\')">Deny</button>';
    }
    html += '    <button class="btn-edit" onclick="showEditForm(\'' + escapeHtml(id) + '\')">Edit</button>';
    html += '    <button class="btn-delete" onclick="deleteAppointment(\'' + escapeHtml(id) + '\')">Delete</button>';
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

  // --- Custom Calendar for Admin Forms ---
  // Mirrors the custom calendar used on the appointment request form in main.js
  function initAdminCalendar(dateInputId) {
    var dateInput = document.getElementById(dateInputId);
    if (!dateInput) return;

    var calendarPopup = dateInput.parentElement.querySelector('.calendar-popup');
    if (!calendarPopup) return;

    var currentMonth = new Date();
    var selectedDate = null;
    var today = new Date();
    today.setHours(0,0,0,0);

    // If input already has a display value, try to parse the underlying date
    if (dateInput.dataset.dateValue) {
      var parts = dateInput.dataset.dateValue.split('-');
      if (parts.length === 3) {
        selectedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        selectedDate.setHours(0,0,0,0);
        currentMonth = new Date(selectedDate);
      }
    }

    function renderCalendar() {
      var year = currentMonth.getFullYear();
      var month = currentMonth.getMonth();
      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      var html = '<div class="calendar-header">';
      html += '<button type="button" class="calendar-prev">&lsaquo;</button>';
      html += '<span class="calendar-month">' + monthNames[month] + ' ' + year + '</span>';
      html += '<button type="button" class="calendar-next">&rsaquo;</button>';
      html += '</div>';
      html += '<div class="calendar-grid">';

      var dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (var dl = 0; dl < dayLabels.length; dl++) {
        html += '<span class="day-label">' + dayLabels[dl] + '</span>';
      }

      for (var i = 0; i < firstDay; i++) {
        html += '<span class="day empty"></span>';
      }

      for (var d = 1; d <= daysInMonth; d++) {
        var date = new Date(year, month, d);
        date.setHours(0,0,0,0);
        var dayOfWeek = date.getDay();
        var isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        var isPast = date < today;
        var isDisabled = isWeekend || isPast;
        var isToday = date.getTime() === today.getTime();
        var isSelected = selectedDate && date.getTime() === selectedDate.getTime();

        var classes = 'day';
        if (isDisabled) classes += ' disabled';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';

        html += '<span class="' + classes + '" data-date="' + year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0') + '">' + d + '</span>';
      }

      html += '</div>';
      calendarPopup.innerHTML = html;

      // Navigation
      calendarPopup.querySelector('.calendar-prev').addEventListener('click', function(e) {
        e.stopPropagation();
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
      });
      calendarPopup.querySelector('.calendar-next').addEventListener('click', function(e) {
        e.stopPropagation();
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
      });

      // Day selection
      var dayEls = calendarPopup.querySelectorAll('.day:not(.disabled):not(.empty)');
      for (var j = 0; j < dayEls.length; j++) {
        (function(el) {
          el.addEventListener('click', function(e) {
            e.stopPropagation();
            var p = el.dataset.date.split('-');
            selectedDate = new Date(p[0], p[1]-1, p[2]);
            selectedDate.setHours(0,0,0,0);
            var options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            dateInput.value = selectedDate.toLocaleDateString('en-US', options);
            // Store the YYYY-MM-DD value for form submission
            dateInput.dataset.dateValue = el.dataset.date;
            calendarPopup.classList.remove('active');
          });
        })(dayEls[j]);
      }
    }

    // Toggle calendar on input click
    dateInput.addEventListener('click', function(e) {
      e.stopPropagation();
      if (dateInput.disabled) return;
      currentMonth = selectedDate ? new Date(selectedDate) : new Date();
      renderCalendar();
      calendarPopup.classList.toggle('active');
    });

    // Close when clicking outside
    var closeHandler = function(e) {
      if (!calendarPopup.contains(e.target) && e.target !== dateInput) {
        calendarPopup.classList.remove('active');
      }
    };
    document.addEventListener('click', closeHandler);

    calendarPopup.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    // Store cleanup reference
    dateInput._calendarCleanup = function() {
      document.removeEventListener('click', closeHandler);
    };
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
    if (existingForm) {
      // Clean up calendar event listener
      var oldInput = existingForm.querySelector('.date-input');
      if (oldInput && oldInput._calendarCleanup) oldInput._calendarCleanup();
      existingForm.remove();
    }

    // Pre-fill date from customer's preferred date
    var prefillDate = '';
    var prefillDisplay = '';
    if (appointment && appointment.preferredDate) {
      var parsed = new Date(appointment.preferredDate);
      if (!isNaN(parsed.getTime())) {
        var yyyy = parsed.getFullYear();
        var mm = String(parsed.getMonth() + 1).padStart(2, '0');
        var dd = String(parsed.getDate()).padStart(2, '0');
        prefillDate = yyyy + '-' + mm + '-' + dd;
        prefillDisplay = parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    var eid = escapeHtml(appointmentId);

    var formHtml = '<div class="approval-form-title">Schedule Drop-off</div>'
      + '<div class="approval-form-row">'
      + '  <div class="approval-form-field">'
      + '    <label for="dropoff-date-' + eid + '">Drop-off Date</label>'
      + '    <div class="date-picker-wrapper">'
      + '      <input type="text" id="dropoff-date-' + eid + '" class="date-input" placeholder="Select a date" readonly'
      + (prefillDisplay ? ' value="' + escapeHtml(prefillDisplay) + '"' : '')
      + (prefillDate ? ' data-date-value="' + prefillDate + '"' : '')
      + '>'
      + '      <div class="calendar-popup" id="calendarPopup-' + eid + '"></div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="approval-form-field">'
      + '    <label for="dropoff-time-' + eid + '">Drop-off Time</label>'
      + '    <input type="time" id="dropoff-time-' + eid + '" value="09:00">'
      + '  </div>'
      + '</div>'
      + '<div class="approval-form-actions">'
      + '  <button class="btn-confirm-approve" onclick="confirmApproval(\'' + eid + '\')">Confirm Approval</button>'
      + '  <button class="approval-form-cancel" onclick="cancelApprovalForm(\'' + eid + '\')">Cancel</button>'
      + '</div>';

    var formEl = document.createElement('div');
    formEl.className = 'approval-form';
    formEl.innerHTML = formHtml;
    card.appendChild(formEl);

    // Initialize the custom calendar on the new date input
    initAdminCalendar('dropoff-date-' + appointmentId);
  };

  // --- Cancel / Dismiss Approval Form ---
  window.cancelApprovalForm = function(appointmentId) {
    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;
    var form = card.querySelector('.approval-form');
    if (form) {
      // Clean up calendar event listener
      var dateInput = form.querySelector('.date-input');
      if (dateInput && dateInput._calendarCleanup) dateInput._calendarCleanup();
      form.remove();
    }
  };

  // --- Confirm Approval with Drop-off Date/Time ---
  window.confirmApproval = function(appointmentId) {
    var dateInput = document.getElementById('dropoff-date-' + appointmentId);
    var timeInput = document.getElementById('dropoff-time-' + appointmentId);

    // The custom calendar stores YYYY-MM-DD in data-date-value; the display value is the readable string
    var dropoffDate = dateInput ? (dateInput.dataset.dateValue || dateInput.value) : '';
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

  // --- Show Inline Deny Confirmation ---
  window.showDenyConfirm = function(appointmentId) {
    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;

    // Remove any existing deny confirm on this card
    var existing = card.querySelector('.deny-confirm');
    if (existing) existing.remove();

    var confirmHtml = '<span class="deny-confirm-text">Are you sure?</span>'
      + '<button class="btn-confirm-deny" onclick="denyAppointment(\'' + escapeHtml(appointmentId) + '\')">Confirm Deny</button>'
      + '<button class="deny-confirm-cancel" onclick="cancelDenyConfirm(\'' + escapeHtml(appointmentId) + '\')">Cancel</button>';

    var confirmEl = document.createElement('div');
    confirmEl.className = 'deny-confirm';
    confirmEl.innerHTML = confirmHtml;
    card.appendChild(confirmEl);
  };

  // --- Cancel / Dismiss Deny Confirmation ---
  window.cancelDenyConfirm = function(appointmentId) {
    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;
    var confirm = card.querySelector('.deny-confirm');
    if (confirm) confirm.remove();
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
    if (approvalForm) {
      var calDateInput = approvalForm.querySelector('.date-input');
      if (calDateInput && calDateInput._calendarCleanup) calDateInput._calendarCleanup();
      approvalForm.remove();
    }

    // Remove inline deny confirmation if present
    var denyConfirm = card.querySelector('.deny-confirm');
    if (denyConfirm) denyConfirm.remove();

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

    // Replace action buttons — remove approve/deny, keep edit and delete
    var actionsContainer = document.getElementById('appt-actions-' + appointmentId);
    if (actionsContainer) {
      actionsContainer.innerHTML = '<button class="btn-edit" onclick="showEditForm(\'' + escapeHtml(appointmentId) + '\')">Edit</button>'
        + '<button class="btn-delete" onclick="deleteAppointment(\'' + escapeHtml(appointmentId) + '\')">Delete</button>';
    }

    // If current filter doesn't match new status, re-render
    if (currentFilter !== 'all' && currentFilter !== newStatus) {
      renderAppointments();
    }
  }

  // --- Delete Appointment ---
  window.deleteAppointment = function(appointmentId) {
    if (!confirm('Are you sure you want to delete this appointment? This cannot be undone.')) {
      return;
    }
    db.collection('appointments').doc(appointmentId).delete().then(function() {
      // Remove from local array
      for (var i = 0; i < allAppointments.length; i++) {
        if (allAppointments[i]._id === appointmentId) {
          allAppointments.splice(i, 1);
          break;
        }
      }
      updateStats();
      renderAppointments();
    }).catch(function(error) {
      console.error('Error deleting appointment:', error);
      alert('Error deleting appointment. Please try again.');
    });
  };

  // --- Show Inline Edit Form ---
  window.showEditForm = function(appointmentId) {
    var appointment = null;
    for (var i = 0; i < allAppointments.length; i++) {
      if (allAppointments[i]._id === appointmentId) {
        appointment = allAppointments[i];
        break;
      }
    }
    if (!appointment) return;

    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;

    // Remove any existing edit or approval form on this card
    var existingEdit = card.querySelector('.edit-form');
    if (existingEdit) existingEdit.remove();
    var existingApproval = card.querySelector('.approval-form');
    if (existingApproval) existingApproval.remove();

    var eid = escapeHtml(appointmentId);
    var statusOptions = '<option value="pending"' + ((appointment.status || 'pending') === 'pending' ? ' selected' : '') + '>pending</option>'
      + '<option value="approved"' + (appointment.status === 'approved' ? ' selected' : '') + '>approved</option>'
      + '<option value="denied"' + (appointment.status === 'denied' ? ' selected' : '') + '>denied</option>';

    // Split userName into first and last on first space
    var fullName = appointment.userName || '';
    var spaceIdx = fullName.indexOf(' ');
    var editFirstName = spaceIdx !== -1 ? fullName.substring(0, spaceIdx) : fullName;
    var editLastName = spaceIdx !== -1 ? fullName.substring(spaceIdx + 1) : '';

    var formHtml = '<div class="approval-form-title">Edit Appointment</div>'
      + '<div class="approval-form-row">'
      + '  <div class="approval-form-field"><label for="edit-firstname-' + eid + '">First Name</label>'
      + '    <input type="text" id="edit-firstname-' + eid + '" value="' + escapeHtml(editFirstName) + '"></div>'
      + '  <div class="approval-form-field"><label for="edit-lastname-' + eid + '">Last Name</label>'
      + '    <input type="text" id="edit-lastname-' + eid + '" value="' + escapeHtml(editLastName) + '"></div>'
      + '  <div class="approval-form-field"><label for="edit-email-' + eid + '">Email</label>'
      + '    <input type="email" id="edit-email-' + eid + '" value="' + escapeHtml(appointment.userEmail || '') + '"></div>'
      + '  <div class="approval-form-field"><label for="edit-phone-' + eid + '">Phone</label>'
      + '    <input type="tel" id="edit-phone-' + eid + '" maxlength="14" placeholder="(231) 675-0723" oninput="formatAdminPhone(this)" value="' + escapeHtml(appointment.userPhone || '') + '"></div>'
      + '</div>'
      + '<div class="approval-form-row">'
      + '  <div class="approval-form-field"><label for="edit-year-' + eid + '">Year</label>'
      + '    <input type="number" id="edit-year-' + eid + '" min="1900" max="2027" placeholder="2003" value="' + escapeHtml(appointment.vehicleYear || '') + '"></div>'
      + '  <div class="approval-form-field"><label for="edit-make-' + eid + '">Make</label>'
      + '    <input type="text" id="edit-make-' + eid + '" placeholder="e.g. Dodge" value="' + escapeHtml(appointment.vehicleMake || '') + '"></div>'
      + '  <div class="approval-form-field"><label for="edit-model-' + eid + '">Model</label>'
      + '    <input type="text" id="edit-model-' + eid + '" placeholder="e.g. Ram 1500" value="' + escapeHtml(appointment.vehicleModel || '') + '"></div>'
      + '  <div class="approval-form-field"><label for="edit-plate-' + eid + '">Plate</label>'
      + '    <input type="text" id="edit-plate-' + eid + '" maxlength="8" placeholder="e.g. ABC1234" style="text-transform:uppercase;" value="' + escapeHtml(appointment.licensePlate || '') + '"></div>'
      + '</div>'
      + '<div class="approval-form-row">'
      + '  <div class="approval-form-field"><label for="edit-prefdate-' + eid + '">Preferred Date</label>'
      + '    <input type="text" id="edit-prefdate-' + eid + '" value="' + escapeHtml(appointment.preferredDate || '') + '"></div>'
      + '  <div class="approval-form-field"><label for="edit-status-' + eid + '">Status</label>'
      + '    <select id="edit-status-' + eid + '">' + statusOptions + '</select></div>'
      + '  <div class="approval-form-field"><label for="edit-dropoff-date-' + eid + '">Drop-off Date</label>'
      + '    <input type="text" id="edit-dropoff-date-' + eid + '" value="' + escapeHtml(appointment.dropoffDate || '') + '"></div>'
      + '  <div class="approval-form-field"><label for="edit-dropoff-time-' + eid + '">Drop-off Time</label>'
      + '    <input type="text" id="edit-dropoff-time-' + eid + '" value="' + escapeHtml(appointment.dropoffTime || '') + '"></div>'
      + '</div>'
      + '<div class="approval-form-row">'
      + '  <div class="approval-form-field" style="flex:1;"><label for="edit-message-' + eid + '">Message</label>'
      + '    <textarea id="edit-message-' + eid + '" rows="2" style="padding:7px 10px;border:1px solid #CCC;border-radius:4px;font-family:\'Open Sans\',sans-serif;font-size:0.85rem;color:#333;background:var(--white);width:100%;box-sizing:border-box;resize:vertical;">' + escapeHtml(appointment.message || '') + '</textarea></div>'
      + '</div>'
      + '<div class="approval-form-actions">'
      + '  <button class="btn-confirm-approve" onclick="saveEdit(\'' + eid + '\')">Save Changes</button>'
      + '  <button class="approval-form-cancel" onclick="cancelEditForm(\'' + eid + '\')">Cancel</button>'
      + '</div>';

    var formEl = document.createElement('div');
    formEl.className = 'edit-form';
    formEl.innerHTML = formHtml;
    card.appendChild(formEl);
  };

  // --- Cancel Edit Form ---
  window.cancelEditForm = function(appointmentId) {
    var card = document.getElementById('appt-' + appointmentId);
    if (!card) return;
    var form = card.querySelector('.edit-form');
    if (form) form.remove();
  };

  // --- Save Edit ---
  window.saveEdit = function(appointmentId) {
    var firstName = document.getElementById('edit-firstname-' + appointmentId).value.trim();
    var lastName = document.getElementById('edit-lastname-' + appointmentId).value.trim();
    var combinedName = lastName ? firstName + ' ' + lastName : firstName;
    var data = {
      userName: combinedName,
      userEmail: document.getElementById('edit-email-' + appointmentId).value.trim(),
      userPhone: document.getElementById('edit-phone-' + appointmentId).value.trim(),
      vehicleYear: document.getElementById('edit-year-' + appointmentId).value.trim(),
      vehicleMake: document.getElementById('edit-make-' + appointmentId).value.trim(),
      vehicleModel: document.getElementById('edit-model-' + appointmentId).value.trim(),
      licensePlate: document.getElementById('edit-plate-' + appointmentId).value.trim(),
      preferredDate: document.getElementById('edit-prefdate-' + appointmentId).value.trim(),
      status: document.getElementById('edit-status-' + appointmentId).value,
      dropoffDate: document.getElementById('edit-dropoff-date-' + appointmentId).value.trim(),
      dropoffTime: document.getElementById('edit-dropoff-time-' + appointmentId).value.trim(),
      message: document.getElementById('edit-message-' + appointmentId).value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('appointments').doc(appointmentId).update(data).then(function() {
      // Update local array
      for (var i = 0; i < allAppointments.length; i++) {
        if (allAppointments[i]._id === appointmentId) {
          for (var key in data) {
            if (key !== 'updatedAt') {
              allAppointments[i][key] = data[key];
            }
          }
          break;
        }
      }
      updateStats();
      renderAppointments();
    }).catch(function(error) {
      console.error('Error saving edit:', error);
      alert('Error saving changes. Please try again.');
    });
  };

  // --- Show Add Appointment Form ---
  window.showAddAppointmentForm = function() {
    var container = document.getElementById('appointments-list');
    if (!container) return;

    // Remove existing add form if present
    var existing = document.getElementById('new-appointment-form');
    if (existing) existing.remove();

    var formHtml = '<div class="admin-appt-card" id="new-appointment-form">'
      + '<div class="edit-form" style="width:100%;">'
      + '  <div class="approval-form-title">New Appointment</div>'
      + '  <div class="approval-form-row">'
      + '    <div class="approval-form-field"><label for="new-firstname">First Name *</label>'
      + '      <input type="text" id="new-firstname" placeholder="First name"></div>'
      + '    <div class="approval-form-field"><label for="new-lastname">Last Name *</label>'
      + '      <input type="text" id="new-lastname" placeholder="Last name"></div>'
      + '    <div class="approval-form-field"><label for="new-email">Email</label>'
      + '      <input type="email" id="new-email" placeholder="email@example.com"></div>'
      + '    <div class="approval-form-field"><label for="new-phone">Phone</label>'
      + '      <input type="tel" id="new-phone" maxlength="14" placeholder="(231) 675-0723" oninput="formatAdminPhone(this)"></div>'
      + '  </div>'
      + '  <div class="approval-form-row">'
      + '    <div class="approval-form-field"><label for="new-year">Year *</label>'
      + '      <input type="number" id="new-year" min="1900" max="2027" placeholder="2003"></div>'
      + '    <div class="approval-form-field"><label for="new-make">Make *</label>'
      + '      <input type="text" id="new-make" placeholder="e.g. Dodge"></div>'
      + '    <div class="approval-form-field"><label for="new-model">Model *</label>'
      + '      <input type="text" id="new-model" placeholder="e.g. Ram 1500"></div>'
      + '    <div class="approval-form-field"><label for="new-plate">Plate</label>'
      + '      <input type="text" id="new-plate" maxlength="8" placeholder="e.g. ABC1234" style="text-transform:uppercase;"></div>'
      + '  </div>'
      + '  <div class="approval-form-row">'
      + '    <div class="approval-form-field"><label for="new-prefdate">Preferred Date</label>'
      + '      <input type="text" id="new-prefdate" placeholder="e.g. March 5, 2026"></div>'
      + '    <div class="approval-form-field"><label for="new-status">Status</label>'
      + '      <select id="new-status">'
      + '        <option value="pending" selected>pending</option>'
      + '        <option value="approved">approved</option>'
      + '        <option value="denied">denied</option>'
      + '      </select></div>'
      + '  </div>'
      + '  <div class="approval-form-row">'
      + '    <div class="approval-form-field" style="flex:1;"><label for="new-message">Message</label>'
      + '      <textarea id="new-message" rows="2" style="padding:7px 10px;border:1px solid #CCC;border-radius:4px;font-family:\'Open Sans\',sans-serif;font-size:0.85rem;color:#333;background:var(--white);width:100%;box-sizing:border-box;resize:vertical;" placeholder="Notes about the appointment"></textarea></div>'
      + '  </div>'
      + '  <div class="approval-form-actions">'
      + '    <button class="btn-confirm-approve" onclick="submitNewAppointment()">Create Appointment</button>'
      + '    <button class="approval-form-cancel" onclick="cancelAddAppointmentForm()">Cancel</button>'
      + '  </div>'
      + '</div>'
      + '</div>';

    container.insertAdjacentHTML('afterbegin', formHtml);
  };

  // --- Cancel Add Appointment Form ---
  window.cancelAddAppointmentForm = function() {
    var form = document.getElementById('new-appointment-form');
    if (form) form.remove();
  };

  // --- Submit New Appointment ---
  window.submitNewAppointment = function() {
    var firstName = document.getElementById('new-firstname').value.trim();
    var lastName = document.getElementById('new-lastname').value.trim();
    var year = document.getElementById('new-year').value.trim();
    var make = document.getElementById('new-make').value.trim();
    var model = document.getElementById('new-model').value.trim();

    if (!firstName || !lastName || !year || !make || !model) {
      alert('Please fill in the required fields: First Name, Last Name, Year, Make, and Model.');
      return;
    }

    var combinedName = firstName + ' ' + lastName;

    var data = {
      userName: combinedName,
      userEmail: document.getElementById('new-email').value.trim(),
      userPhone: document.getElementById('new-phone').value.trim(),
      vehicleYear: year,
      vehicleMake: make,
      vehicleModel: model,
      licensePlate: document.getElementById('new-plate').value.trim(),
      preferredDate: document.getElementById('new-prefdate').value.trim(),
      status: document.getElementById('new-status').value,
      message: document.getElementById('new-message').value.trim(),
      userId: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('appointments').add(data).then(function(docRef) {
      // Add to local array with the new ID
      var localCopy = {};
      for (var key in data) {
        if (key !== 'createdAt') {
          localCopy[key] = data[key];
        }
      }
      localCopy._id = docRef.id;
      localCopy.createdAt = new Date();
      allAppointments.unshift(localCopy);
      updateStats();
      renderAppointments();
    }).catch(function(error) {
      console.error('Error creating appointment:', error);
      alert('Error creating appointment. Please try again.');
    });
  };

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

    var currentUser = auth.currentUser;
    var currentUid = currentUser ? currentUser.uid : '';

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
          var userId = doc.id;
          var memberSince = formatDateShort(c.createdAt);
          var isSelf = userId === currentUid;

          html += '<div class="admin-customer-card" id="customer-' + escapeHtml(userId) + '">';
          html += '  <div class="customer-info">';
          html += '    <span class="customer-name">' + escapeHtml(c.name || 'Unknown') + '</span>';
          html += '    <span class="customer-email">' + escapeHtml(c.email || '') + '</span>';
          if (c.phone) {
            html += '    <span class="customer-phone">' + escapeHtml(c.phone) + '</span>';
          }
          html += '  </div>';
          html += '  <div class="customer-actions" style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">';
          html += '    <div class="customer-meta" style="text-align: right; font-size: 0.8rem; color: #999;">';
          html += '      Member since ' + escapeHtml(memberSince);
          html += '    </div>';
          if (!isSelf) {
            html += '    <button class="btn-delete" onclick="deleteCustomer(\'' + escapeHtml(userId) + '\')">Delete</button>';
          }
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

  // --- Delete Customer ---
  window.deleteCustomer = function(userId) {
    if (!confirm('Are you sure you want to delete this customer? This cannot be undone.')) {
      return;
    }

    // First, delete all vehicles in the subcollection
    db.collection('users').doc(userId).collection('vehicles').get()
      .then(function(vehicleSnapshot) {
        var deletePromises = [];
        vehicleSnapshot.forEach(function(vehicleDoc) {
          deletePromises.push(vehicleDoc.ref.delete());
        });
        return Promise.all(deletePromises);
      })
      .then(function() {
        // Then delete the user document itself
        return db.collection('users').doc(userId).delete();
      })
      .then(function() {
        // Remove the customer card from the DOM
        var card = document.getElementById('customer-' + userId);
        if (card) {
          card.remove();
        }

        // If no customers left, show empty state
        var container = document.getElementById('customers-list');
        if (container && !container.querySelector('.admin-customer-card')) {
          container.innerHTML = '<p class="empty-state">No customers yet.</p>';
        }
      })
      .catch(function(error) {
        console.error('Error deleting customer:', error);
        alert('Error deleting customer. Please try again.');
      });
  };

})();
