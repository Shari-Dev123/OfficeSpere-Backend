// controllers/meetingController.js
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const { sendEmail } = require('../utils/sendEmail');

// @desc    Get all meetings (Admin)
// @route   GET /api/admin/meetings
// @access  Private/Admin
exports.getAllMeetings = async (req, res) => {
  try {
    const { status, startDate, endDate, type } = req.query;
    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    // Filter by type
    if (type) {
      query.type = type;
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email role')
      .populate('project', 'name')
      .sort({ scheduledDate: -1 });

    res.status(200).json({
      success: true,
      count: meetings.length,
      meetings
    });
  } catch (error) {
    console.error('Get all meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meetings',
      error: error.message
    });
  }
};

// @desc    Get single meeting
// @route   GET /api/admin/meetings/:id
// @access  Private
exports.getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email role')
      .populate('project', 'name client')
      .populate('createdBy', 'name email');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is authorized to view this meeting
    const isParticipant = meeting.participants.some(
      p => p.user._id.toString() === req.user.id
    );
    const isOrganizer = meeting.organizer._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isParticipant && !isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this meeting'
      });
    }

    res.status(200).json({
      success: true,
      meeting
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meeting',
      error: error.message
    });
  }
};

// @desc    Schedule new meeting
// @route   POST /api/admin/meetings
// @access  Private/Admin
exports.scheduleMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      scheduledDate,
      duration,
      location,
      meetingLink,
      participants,
      project,
      agenda,
      isRecurring,
      recurringPattern
    } = req.body;

    // Validate required fields
    if (!title || !scheduledDate || !duration || !participants || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, scheduled date, duration, and participants'
      });
    }

    // Validate participants exist
    const participantUsers = await User.find({
      _id: { $in: participants }
    });

    if (participantUsers.length !== participants.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more participants not found'
      });
    }

    // Create meeting
    const meeting = await Meeting.create({
      title,
      description,
      type,
      scheduledDate,
      duration,
      location,
      meetingLink,
      participants: participants.map(userId => ({
        user: userId,
        status: 'pending'
      })),
      project,
      agenda,
      isRecurring,
      recurringPattern,
      organizer: req.user.id,
      createdBy: req.user.id
    });

    // Populate meeting
    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email')
      .populate('project', 'name');

    // Send email notifications to participants
    for (const participant of participantUsers) {
      try {
        await sendEmail({
          to: participant.email,
          subject: `Meeting Scheduled: ${title}`,
          html: `
            <h2>You have been invited to a meeting</h2>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Date:</strong> ${new Date(scheduledDate).toLocaleString()}</p>
            <p><strong>Duration:</strong> ${duration} minutes</p>
            ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
            ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
            ${meetingLink ? `<p><strong>Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ''}
            <p>Please confirm your attendance.</p>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      meeting: populatedMeeting
    });
  } catch (error) {
    console.error('Schedule meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling meeting',
      error: error.message
    });
  }
};

// @desc    Update meeting
// @route   PUT /api/admin/meetings/:id
// @access  Private/Admin
exports.updateMeeting = async (req, res) => {
  try {
    let meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    const {
      title,
      description,
      type,
      scheduledDate,
      duration,
      location,
      meetingLink,
      participants,
      status,
      agenda
    } = req.body;

    // Update fields
    if (title) meeting.title = title;
    if (description) meeting.description = description;
    if (type) meeting.type = type;
    if (scheduledDate) meeting.scheduledDate = scheduledDate;
    if (duration) meeting.duration = duration;
    if (location) meeting.location = location;
    if (meetingLink) meeting.meetingLink = meetingLink;
    if (status) meeting.status = status;
    if (agenda) meeting.agenda = agenda;

    // Update participants if provided
    if (participants && participants.length > 0) {
      meeting.participants = participants.map(userId => ({
        user: userId,
        status: 'pending'
      }));
    }

    meeting.updatedAt = Date.now();

    await meeting.save();

    const updatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email')
      .populate('project', 'name');

    // Send update notifications
    const participantUsers = await User.find({
      _id: { $in: meeting.participants.map(p => p.user) }
    });

    for (const participant of participantUsers) {
      try {
        await sendEmail({
          to: participant.email,
          subject: `Meeting Updated: ${title}`,
          html: `
            <h2>Meeting details have been updated</h2>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Date:</strong> ${new Date(scheduledDate).toLocaleString()}</p>
            <p><strong>Duration:</strong> ${duration} minutes</p>
            <p>Please check the updated details in your dashboard.</p>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Meeting updated successfully',
      meeting: updatedMeeting
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating meeting',
      error: error.message
    });
  }
};

// @desc    Delete meeting
// @route   DELETE /api/admin/meetings/:id
// @access  Private/Admin
exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Get participants before deleting
    const participantUsers = await User.find({
      _id: { $in: meeting.participants.map(p => p.user) }
    });

    await meeting.deleteOne();

    // Send cancellation notifications
    for (const participant of participantUsers) {
      try {
        await sendEmail({
          to: participant.email,
          subject: `Meeting Cancelled: ${meeting.title}`,
          html: `
            <h2>Meeting has been cancelled</h2>
            <p><strong>Title:</strong> ${meeting.title}</p>
            <p><strong>Scheduled Date:</strong> ${new Date(meeting.scheduledDate).toLocaleString()}</p>
            <p>This meeting has been cancelled by the organizer.</p>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting meeting',
      error: error.message
    });
  }
};

// @desc    Add meeting minutes/notes
// @route   POST /api/admin/meetings/:id/minutes
// @access  Private/Admin
exports.addMeetingMinutes = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    const { minutes, actionItems, decisions } = req.body;

    meeting.minutes = minutes;
    meeting.actionItems = actionItems || [];
    meeting.decisions = decisions || [];
    meeting.status = 'completed';
    meeting.actualEndTime = new Date();

    await meeting.save();

    const updatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email');

    res.status(200).json({
      success: true,
      message: 'Meeting minutes added successfully',
      meeting: updatedMeeting
    });
  } catch (error) {
    console.error('Add meeting minutes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding meeting minutes',
      error: error.message
    });
  }
};

// @desc    Update participant status
// @route   PATCH /api/meetings/:id/status
// @access  Private
exports.updateParticipantStatus = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    const { status } = req.body; // 'accepted', 'declined', 'tentative'

    if (!['accepted', 'declined', 'tentative'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const participant = meeting.participants.find(
      p => p.user.toString() === req.user.id
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'You are not a participant in this meeting'
      });
    }

    participant.status = status;
    participant.respondedAt = new Date();

    await meeting.save();

    res.status(200).json({
      success: true,
      message: `Meeting ${status} successfully`,
      meeting
    });
  } catch (error) {
    console.error('Update participant status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating participant status',
      error: error.message
    });
  }
};

// @desc    Get my meetings (Employee/Client)
// @route   GET /api/employee/meetings OR /api/client/meetings
// @access  Private
exports.getMyMeetings = async (req, res) => {
  try {
    const { status, upcoming } = req.query;
    let query = {
      'participants.user': req.user.id
    };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Get only upcoming meetings
    if (upcoming === 'true') {
      query.scheduledDate = { $gte: new Date() };
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email role')
      .populate('project', 'name')
      .sort({ scheduledDate: 1 });

    res.status(200).json({
      success: true,
      count: meetings.length,
      meetings
    });
  } catch (error) {
    console.error('Get my meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meetings',
      error: error.message
    });
  }
};

// @desc    Schedule meeting (Client)
// @route   POST /api/client/meetings
// @access  Private/Client
exports.clientScheduleMeeting = async (req, res) => {
  try {
    const { title, description, scheduledDate, duration, participants, project } = req.body;

    if (!title || !scheduledDate || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, scheduled date, and duration'
      });
    }

    // Create meeting with client as organizer
    const meeting = await Meeting.create({
      title,
      description,
      type: 'client',
      scheduledDate,
      duration,
      participants: participants?.map(userId => ({
        user: userId,
        status: 'pending'
      })) || [],
      project,
      organizer: req.user.id,
      createdBy: req.user.id
    });

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email')
      .populate('project', 'name');

    res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      meeting: populatedMeeting
    });
  } catch (error) {
    console.error('Client schedule meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling meeting',
      error: error.message
    });
  }
};

// @desc    Cancel meeting (Client)
// @route   DELETE /api/client/meetings/:id
// @access  Private/Client
exports.clientCancelMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if client is the organizer
    if (meeting.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this meeting'
      });
    }

    meeting.status = 'cancelled';
    await meeting.save();

    res.status(200).json({
      success: true,
      message: 'Meeting cancelled successfully'
    });
  } catch (error) {
    console.error('Client cancel meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling meeting',
      error: error.message
    });
  }
};

module.exports = exports;