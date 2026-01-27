// controllers/clientController.js

const Client = require('../models/Client');
const Project = require('../models/Project');
const Meeting = require('../models/Meeting');
const DailyReport = require('../models/DailyReport');

// @desc    Get client dashboard data
// @route   GET /api/client/dashboard
// @access  Private (Client only)
exports.getDashboard = async (req, res) => {
  try {
    const clientId = req.user.id;

    // Get client's projects
    const projects = await Project.find({ client: clientId })
      .select('name status startDate endDate budget progress')
      .lean();

    // Count projects by status
    const activeProjects = projects.filter(p => p.status === 'in_progress').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const pendingProjects = projects.filter(p => p.status === 'planning').length;

    // Get upcoming meetings
    const upcomingMeetings = await Meeting.find({
      participants: clientId,
      meetingDate: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    })
      .sort({ meetingDate: 1 })
      .limit(5)
      .populate('organizer', 'name email')
      .lean();

    // Calculate total investment and average progress
    const totalInvestment = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const averageProgress = projects.length > 0 
      ? projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length 
      : 0;

    // Get recent feedback submitted
    const recentFeedback = await Project.find({
      client: clientId,
      'feedback.0': { $exists: true }
    })
      .select('name feedback')
      .sort({ 'feedback.submittedAt': -1 })
      .limit(3)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalProjects: projects.length,
          activeProjects,
          completedProjects,
          pendingProjects,
          totalInvestment,
          averageProgress: Math.round(averageProgress)
        },
        recentProjects: projects.slice(0, 5),
        upcomingMeetings,
        recentFeedback
      }
    });
  } catch (error) {
    console.error('Get client dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
};

// @desc    Get all client's projects
// @route   GET /api/client/projects
// @access  Private (Client only)
exports.getMyProjects = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { status, search, sortBy = 'createdAt', order = 'desc' } = req.query;

    // Build query
    const query = { client: clientId };
    
    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const projects = await Project.find(query)
      .populate('assignedTeam', 'name email role')
      .sort(sortOptions)
      .lean();

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Get client projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
};

// @desc    Get single project details
// @route   GET /api/client/projects/:id
// @access  Private (Client only)
exports.getProject = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const project = await Project.findOne({ _id: id, client: clientId })
      .populate('assignedTeam', 'name email role avatar')
      .populate('client', 'companyName contactPerson email')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project',
      error: error.message
    });
  }
};

// @desc    Get project progress
// @route   GET /api/client/projects/:id/progress
// @access  Private (Client only)
exports.getProjectProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const project = await Project.findOne({ _id: id, client: clientId })
      .select('name progress milestones status startDate endDate')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Calculate milestone completion
    const totalMilestones = project.milestones?.length || 0;
    const completedMilestones = project.milestones?.filter(m => m.status === 'completed').length || 0;
    const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

    // Calculate time progress
    const today = new Date();
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const totalDuration = end - start;
    const elapsed = today - start;
    const timeProgress = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        project: {
          name: project.name,
          status: project.status,
          overallProgress: project.progress || 0
        },
        milestones: {
          total: totalMilestones,
          completed: completedMilestones,
          progress: Math.round(milestoneProgress)
        },
        timeline: {
          startDate: project.startDate,
          endDate: project.endDate,
          daysElapsed: Math.floor(elapsed / (1000 * 60 * 60 * 24)),
          daysRemaining: Math.ceil((end - today) / (1000 * 60 * 60 * 24)),
          timeProgress: Math.round(timeProgress)
        }
      }
    });
  } catch (error) {
    console.error('Get project progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project progress',
      error: error.message
    });
  }
};

// @desc    Get project timeline
// @route   GET /api/client/projects/:id/timeline
// @access  Private (Client only)
exports.getProjectTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const project = await Project.findOne({ _id: id, client: clientId })
      .select('name milestones activities createdAt')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Combine milestones and activities into timeline
    const timeline = [];

    // Add milestones
    if (project.milestones) {
      project.milestones.forEach(milestone => {
        timeline.push({
          type: 'milestone',
          title: milestone.title,
          description: milestone.description,
          date: milestone.dueDate,
          status: milestone.status,
          completedAt: milestone.completedAt
        });
      });
    }

    // Add activities
    if (project.activities) {
      project.activities.forEach(activity => {
        timeline.push({
          type: 'activity',
          title: activity.action,
          description: activity.description,
          date: activity.timestamp,
          status: 'completed',
          user: activity.user
        });
      });
    }

    // Sort by date (most recent first)
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      data: {
        projectName: project.name,
        projectCreated: project.createdAt,
        timeline
      }
    });
  } catch (error) {
    console.error('Get project timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project timeline',
      error: error.message
    });
  }
};

// @desc    Get project milestones
// @route   GET /api/client/projects/:id/milestones
// @access  Private (Client only)
exports.getProjectMilestones = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const project = await Project.findOne({ _id: id, client: clientId })
      .select('name milestones')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        projectName: project.name,
        milestones: project.milestones || []
      }
    });
  } catch (error) {
    console.error('Get project milestones error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project milestones',
      error: error.message
    });
  }
};

// @desc    Get client's meetings
// @route   GET /api/client/meetings
// @access  Private (Client only)
exports.getMyMeetings = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { status, upcoming } = req.query;

    // Build query
    const query = { participants: clientId };

    if (status) {
      query.status = status;
    }

    if (upcoming === 'true') {
      query.meetingDate = { $gte: new Date() };
      query.status = { $ne: 'cancelled' };
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('participants', 'name email role')
      .populate('project', 'name')
      .sort({ meetingDate: upcoming === 'true' ? 1 : -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: meetings.length,
      data: meetings
    });
  } catch (error) {
    console.error('Get client meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meetings',
      error: error.message
    });
  }
};

// @desc    Get single meeting details
// @route   GET /api/client/meetings/:id
// @access  Private (Client only)
exports.getMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const meeting = await Meeting.findOne({ 
      _id: id, 
      participants: clientId 
    })
      .populate('organizer', 'name email')
      .populate('participants', 'name email role avatar')
      .populate('project', 'name')
      .lean();

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: meeting
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meeting',
      error: error.message
    });
  }
};

// @desc    Schedule a new meeting
// @route   POST /api/client/meetings
// @access  Private (Client only)
exports.scheduleMeeting = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { title, description, meetingDate, duration, location, meetingLink, project, participants } = req.body;

    // Validation
    if (!title || !meetingDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title and meeting date'
      });
    }

    // Create meeting with client as organizer
    const meeting = await Meeting.create({
      title,
      description,
      meetingDate,
      duration: duration || 60,
      location,
      meetingLink,
      project,
      organizer: clientId,
      participants: [...(participants || []), clientId], // Include client in participants
      status: 'scheduled'
    });

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('organizer', 'name email')
      .populate('participants', 'name email role')
      .populate('project', 'name');

    res.status(201).json({
      success: true,
      message: 'Meeting scheduled successfully',
      data: populatedMeeting
    });
  } catch (error) {
    console.error('Schedule meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule meeting',
      error: error.message
    });
  }
};

// @desc    Cancel a meeting
// @route   DELETE /api/client/meetings/:id
// @access  Private (Client only - organizer)
exports.cancelMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const meeting = await Meeting.findOne({ _id: id, organizer: clientId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found or you are not authorized to cancel it'
      });
    }

    meeting.status = 'cancelled';
    await meeting.save();

    res.status(200).json({
      success: true,
      message: 'Meeting cancelled successfully',
      data: meeting
    });
  } catch (error) {
    console.error('Cancel meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel meeting',
      error: error.message
    });
  }
};

// @desc    Get project reports
// @route   GET /api/client/projects/:id/reports
// @access  Private (Client only)
exports.getProjectReports = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    // Verify project belongs to client
    const project = await Project.findOne({ _id: id, client: clientId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Get daily reports related to this project
    const reports = await DailyReport.find({ project: id })
      .populate('employee', 'name email role')
      .sort({ reportDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('Get project reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project reports',
      error: error.message
    });
  }
};

// @desc    Get weekly project report
// @route   GET /api/client/projects/:id/reports/weekly
// @access  Private (Client only)
exports.getWeeklyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    // Verify project belongs to client
    const project = await Project.findOne({ _id: id, client: clientId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Get reports from last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const reports = await DailyReport.find({
      project: id,
      reportDate: { $gte: lastWeek }
    })
      .populate('employee', 'name email role')
      .sort({ reportDate: -1 })
      .lean();

    // Aggregate data
    const totalHours = reports.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
    const completedTasks = reports.reduce((sum, r) => sum + (r.tasksCompleted?.length || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        projectName: project.name,
        period: {
          from: lastWeek,
          to: new Date()
        },
        summary: {
          totalReports: reports.length,
          totalHours: totalHours.toFixed(2),
          completedTasks
        },
        reports
      }
    });
  } catch (error) {
    console.error('Get weekly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly report',
      error: error.message
    });
  }
};

// @desc    Download project report
// @route   GET /api/client/reports/:id/download
// @access  Private (Client only)
exports.downloadReport = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const report = await DailyReport.findById(id)
      .populate('employee', 'name email role')
      .populate('project', 'name client')
      .lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Verify client owns the project
    if (report.project.client.toString() !== clientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // In a real application, generate PDF or Excel file
    // For now, return formatted data
    res.status(200).json({
      success: true,
      message: 'Report data ready for download',
      data: report
    });
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download report',
      error: error.message
    });
  }
};

// @desc    Submit project feedback
// @route   POST /api/client/projects/:id/feedback
// @access  Private (Client only)
exports.submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    const { rating, comment, category } = req.body;

    // Validation
    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide rating and comment'
      });
    }

    const project = await Project.findOne({ _id: id, client: clientId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Add feedback
    if (!project.feedback) {
      project.feedback = [];
    }

    project.feedback.push({
      rating,
      comment,
      category: category || 'general',
      submittedAt: new Date()
    });

    await project.save();

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: project.feedback[project.feedback.length - 1]
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
};

// @desc    Get feedback history
// @route   GET /api/client/projects/:id/feedback
// @access  Private (Client only)
exports.getFeedbackHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const project = await Project.findOne({ _id: id, client: clientId })
      .select('name feedback')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        projectName: project.name,
        feedback: project.feedback || []
      }
    });
  } catch (error) {
    console.error('Get feedback history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback history',
      error: error.message
    });
  }
};

// @desc    Approve project milestone
// @route   POST /api/client/projects/:id/milestones/:milestoneId/approve
// @access  Private (Client only)
exports.approveMilestone = async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    const clientId = req.user.id;

    const project = await Project.findOne({ _id: id, client: clientId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const milestone = project.milestones.id(milestoneId);

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }

    milestone.status = 'approved';
    milestone.approvedAt = new Date();

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Milestone approved successfully',
      data: milestone
    });
  } catch (error) {
    console.error('Approve milestone error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve milestone',
      error: error.message
    });
  }
};

// @desc    Request changes to milestone
// @route   POST /api/client/projects/:id/milestones/:milestoneId/changes
// @access  Private (Client only)
exports.requestChanges = async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    const clientId = req.user.id;
    const { changeRequest } = req.body;

    if (!changeRequest) {
      return res.status(400).json({
        success: false,
        message: 'Please provide change request details'
      });
    }

    const project = await Project.findOne({ _id: id, client: clientId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const milestone = project.milestones.id(milestoneId);

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }

    milestone.status = 'changes_requested';
    milestone.changeRequest = changeRequest;
    milestone.changeRequestedAt = new Date();

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Change request submitted successfully',
      data: milestone
    });
  } catch (error) {
    console.error('Request changes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit change request',
      error: error.message
    });
  }
};

// @desc    Rate project satisfaction
// @route   POST /api/client/projects/:id/rating
// @access  Private (Client only)
exports.rateSatisfaction = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    const { overallRating, communicationRating, qualityRating, timelinessRating, comments } = req.body;

    if (!overallRating) {
      return res.status(400).json({
        success: false,
        message: 'Please provide overall rating'
      });
    }

    const project = await Project.findOne({ _id: id, client: clientId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    project.clientRating = {
      overall: overallRating,
      communication: communicationRating,
      quality: qualityRating,
      timeliness: timelinessRating,
      comments,
      ratedAt: new Date()
    };

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      data: project.clientRating
    });
  } catch (error) {
    console.error('Rate satisfaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message
    });
  }
};

// @desc    Get client profile
// @route   GET /api/client/profile
// @access  Private (Client only)
exports.getProfile = async (req, res) => {
  try {
    const clientId = req.user.id;

    const client = await Client.findById(clientId)
      .select('-password')
      .lean();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    console.error('Get client profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// @desc    Update client profile
// @route   PUT /api/client/profile
// @access  Private (Client only)
exports.updateProfile = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { contactPerson, email, phone, address, avatar } = req.body;

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Update fields
    if (contactPerson) client.contactPerson = contactPerson;
    if (email) client.email = email;
    if (phone) client.phone = phone;
    if (address) client.address = address;
    if (avatar) client.avatar = avatar;

    await client.save();

    // Remove password from response
    client.password = undefined;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: client
    });
  } catch (error) {
    console.error('Update client profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// @desc    Update company information
// @route   PUT /api/client/profile/company
// @access  Private (Client only)
exports.updateCompanyInfo = async (req, res) => {
  try {
    const clientId = req.user.id;
    const { companyName, industry, website, companySize, taxId } = req.body;

    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Update company fields
    if (companyName) client.companyName = companyName;
    if (industry) client.industry = industry;
    if (website) client.website = website;
    if (companySize) client.companySize = companySize;
    if (taxId) client.taxId = taxId;

    await client.save();

    // Remove password from response
    client.password = undefined;

    res.status(200).json({
      success: true,
      message: 'Company information updated successfully',
      data: client
    });
  } catch (error) {
    console.error('Update company info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company information',
      error: error.message
    });
  }
};

module.exports = exports;