// utils/sendEmail.js
// Email service using nodemailer

const nodemailer = require('nodemailer');

/**
 * Create email transporter
 */
const createTransporter = () => {
  try {
    const transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    return transporter;
  } catch (error) {
    console.error('Error creating email transporter:', error);
    throw new Error('Failed to create email transporter');
  }
};

/**
 * Send Email
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @returns {Promise} - Email send result
 */
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'OfficeSphere'} <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send Welcome Email
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} role - User role
 * @returns {Promise}
 */
const sendWelcomeEmail = async (email, name, role) => {
  const subject = 'Welcome to OfficeSphere!';
  
  const text = `
    Hi ${name},

    Welcome to OfficeSphere!

    Your account has been created successfully as ${role}.

    You can now login to your account and start using OfficeSphere.

    If you have any questions, feel free to contact us.

    Best regards,
    OfficeSphere Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Welcome to OfficeSphere!</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your account has been created successfully as <strong>${role}</strong>.</p>
      <p>You can now login to your account and start using OfficeSphere.</p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/login" 
           style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Login Now
        </a>
      </div>
      <p>If you have any questions, feel free to contact us.</p>
      <p style="color: #666; margin-top: 30px;">
        Best regards,<br>
        <strong>OfficeSphere Team</strong>
      </p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Password Reset Email
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} resetToken - Password reset token
 * @returns {Promise}
 */
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const subject = 'Password Reset Request - OfficeSphere';
  
  const text = `
    Hi ${name},

    You requested to reset your password for your OfficeSphere account.

    Please click on the link below to reset your password:
    ${resetUrl}

    This link will expire in 1 hour.

    If you didn't request this, please ignore this email.

    Best regards,
    OfficeSphere Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Password Reset Request</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>You requested to reset your password for your OfficeSphere account.</p>
      <p>Please click the button below to reset your password:</p>
      <div style="margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #666;">This link will expire in <strong>1 hour</strong>.</p>
      <p style="color: #666;">If you didn't request this, please ignore this email.</p>
      <p style="color: #666; margin-top: 30px;">
        Best regards,<br>
        <strong>OfficeSphere Team</strong>
      </p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Password Changed Confirmation
 * @param {string} email - User email
 * @param {string} name - User name
 * @returns {Promise}
 */
const sendPasswordChangedEmail = async (email, name) => {
  const subject = 'Password Changed Successfully - OfficeSphere';
  
  const text = `
    Hi ${name},

    Your password has been changed successfully.

    If you didn't make this change, please contact support immediately.

    Best regards,
    OfficeSphere Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">Password Changed Successfully</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your password has been changed successfully.</p>
      <p style="color: #ef4444; margin: 20px 0;">
        <strong>If you didn't make this change, please contact support immediately.</strong>
      </p>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/login" 
           style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Login Now
        </a>
      </div>
      <p style="color: #666; margin-top: 30px;">
        Best regards,<br>
        <strong>OfficeSphere Team</strong>
      </p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Task Assignment Email
 * @param {string} email - Employee email
 * @param {string} name - Employee name
 * @param {object} task - Task details
 * @returns {Promise}
 */
const sendTaskAssignmentEmail = async (email, name, task) => {
  const subject = `New Task Assigned: ${task.title}`;
  
  const text = `
    Hi ${name},

    A new task has been assigned to you:

    Task: ${task.title}
    Priority: ${task.priority}
    Due Date: ${task.dueDate}
    Description: ${task.description}

    Please login to view more details.

    Best regards,
    OfficeSphere Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Task Assigned</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>A new task has been assigned to you:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Task:</strong> ${task.title}</p>
        <p><strong>Priority:</strong> <span style="color: ${task.priority === 'high' ? '#ef4444' : '#f59e0b'};">${task.priority}</span></p>
        <p><strong>Due Date:</strong> ${task.dueDate}</p>
        <p><strong>Description:</strong> ${task.description}</p>
      </div>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/employee/tasks" 
           style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Task
        </a>
      </div>
      <p style="color: #666; margin-top: 30px;">
        Best regards,<br>
        <strong>OfficeSphere Team</strong>
      </p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Meeting Invitation Email
 * @param {string} email - Attendee email
 * @param {string} name - Attendee name
 * @param {object} meeting - Meeting details
 * @returns {Promise}
 */
const sendMeetingInvitationEmail = async (email, name, meeting) => {
  const subject = `Meeting Invitation: ${meeting.title}`;
  
  const text = `
    Hi ${name},

    You have been invited to a meeting:

    Meeting: ${meeting.title}
    Date: ${meeting.date}
    Time: ${meeting.time}
    Location: ${meeting.location || 'Online'}
    Agenda: ${meeting.agenda}

    Please confirm your attendance.

    Best regards,
    OfficeSphere Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Meeting Invitation</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>You have been invited to a meeting:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Meeting:</strong> ${meeting.title}</p>
        <p><strong>Date:</strong> ${meeting.date}</p>
        <p><strong>Time:</strong> ${meeting.time}</p>
        <p><strong>Location:</strong> ${meeting.location || 'Online'}</p>
        <p><strong>Agenda:</strong> ${meeting.agenda}</p>
      </div>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/meetings" 
           style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">
          Accept
        </a>
        <a href="${process.env.FRONTEND_URL}/meetings" 
           style="background-color: #6b7280; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Details
        </a>
      </div>
      <p style="color: #666; margin-top: 30px;">
        Best regards,<br>
        <strong>OfficeSphere Team</strong>
      </p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

/**
 * Send Leave Request Notification (to admin)
 * @param {string} adminEmail - Admin email
 * @param {string} employeeName - Employee name
 * @param {object} leaveDetails - Leave request details
 * @returns {Promise}
 */
const sendLeaveRequestNotification = async (adminEmail, employeeName, leaveDetails) => {
  const subject = `Leave Request from ${employeeName}`;
  
  const text = `
    Hello Admin,

    ${employeeName} has submitted a leave request:

    Start Date: ${leaveDetails.startDate}
    End Date: ${leaveDetails.endDate}
    Reason: ${leaveDetails.reason}
    Type: ${leaveDetails.type}

    Please review and approve/reject the request.

    Best regards,
    OfficeSphere System
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Leave Request</h2>
      <p>Hello Admin,</p>
      <p><strong>${employeeName}</strong> has submitted a leave request:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Start Date:</strong> ${leaveDetails.startDate}</p>
        <p><strong>End Date:</strong> ${leaveDetails.endDate}</p>
        <p><strong>Type:</strong> ${leaveDetails.type}</p>
        <p><strong>Reason:</strong> ${leaveDetails.reason}</p>
      </div>
      <div style="margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/admin/attendance" 
           style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Review Request
        </a>
      </div>
      <p style="color: #666; margin-top: 30px;">
        Best regards,<br>
        <strong>OfficeSphere System</strong>
      </p>
    </div>
  `;

  return await sendEmail({ to: adminEmail, subject, text, html });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendTaskAssignmentEmail,
  sendMeetingInvitationEmail,
  sendLeaveRequestNotification
};