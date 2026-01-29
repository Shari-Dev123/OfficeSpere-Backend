// controllers/clientController.js

const Client = require('../models/Client');
const Project = require('../models/Project');
const Meeting = require('../models/Meeting');
const DailyReport = require('../models/DailyReport');

// @desc    Get client dashboard data
// @route   GET /api/client/dashboard
// @access  Private (Client only)
// @desc    Get client dashboard data
// @route   GET /api/client/dashboard
// @access  Private (Client only)
// Add these functions to your clientController.js file
// Place them after the getMyProjects function

// @desc    Create a new project
// @route   POST /api/client/projects
// @access  Private (Client only)
exports.createProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      startDate,
      deadline,
      budget,
      requirements,
      priority,
      status,
      category
    } = req.body;

    console.log('📝 Creating project for user:', userId);
    console.log('Project data:', req.body);

    // Validation
    if (!name || !description || !startDate || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, description, start date, and deadline'
      });
    }

    // Find client by userId
    const Client = require('../models/Client');
    const client = await Client.findOne({ userId: userId });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found. Please complete your profile first.'
      });
    }

    console.log('✅ Client found:', client._id);

    // Generate unique project ID
    const Project = require('../models/Project');
    const projectCount = await Project.countDocuments();
    const projectId = `PRJ${String(projectCount + 1).padStart(4, '0')}`;

    const normalizedPriority =
      priority === 'Critical' ? 'Urgent' : priority || 'Medium';

    // For now, we'll create project without projectManager
    // Admin can assign project manager later
    const projectData = {
      projectId: projectId,
      name: name,
      description: description,
      client: client._id,
      // We'll set a default/placeholder project manager or make it optional
      projectManager: null, // Admin will assign later
      status: status || 'Planning',
      priority: priority || 'Medium',
      startDate: startDate,
      endDate: deadline,
      budget: Number(budget) || 0,
      spent: 0,
      progress: 0,
      tags: category ? [category] : [],
      isActive: true
    };

    console.log('Creating project with data:', projectData);

    const project = await Project.create(projectData);

    console.log('✅ Project created successfully:', project._id);

    // Populate client info for response
    const populatedProject = await Project.findById(project._id)
      .populate('client', 'companyName contactPerson email')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Project created successfully! Admin will assign a project manager soon.',
      data: populatedProject
    });

  } catch (error) {
    console.error('❌ Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create project',
      error: error.message
    });
  }
};

// @desc    Update a project
// @route   PUT /api/client/projects/:id
// @access  Private (Client only)
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    console.log('📝 Updating project:', id);

    // Find client by userId
    const Client = require('../models/Client');
    const client = await Client.findOne({ userId: userId });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    // Find project and verify ownership
    const Project = require('../models/Project');
    const project = await Project.findOne({ _id: id, client: client._id });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Update allowed fields
    const allowedFields = ['name', 'description', 'budget', 'priority', 'endDate'];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        project[field] = updateData[field];
      }
    });

    // Update deadline if provided
    if (updateData.deadline) {
      project.endDate = updateData.deadline;
    }

    // Update tags if category provided
    if (updateData.category) {
      project.tags = [updateData.category];
    }

    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate('client', 'companyName contactPerson email')
      .lean();

    console.log('✅ Project updated successfully');

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    });

  } catch (error) {
    console.error('❌ Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update project',
      error: error.message
    });
  }
};

// @desc    Delete a project
// @route   DELETE /api/client/projects/:id
// @access  Private (Client only)
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('🗑️ Deleting project:', id);

    // Find client by userId
    const Client = require('../models/Client');
    const client = await Client.findOne({ userId: userId });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    // Find project and verify ownership
    const Project = require('../models/Project');
    const project = await Project.findOne({ _id: id, client: client._id });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Check if project can be deleted (only Planning or On Hold projects)
    if (project.status === 'In Progress' || project.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete project with status: ${project.status}`
      });
    }

    // Soft delete by setting isActive to false
    project.isActive = false;
    await project.save();

    // Or hard delete (uncomment if you prefer)
    // await Project.findByIdAndDelete(id);

    console.log('✅ Project deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete project',
      error: error.message
    });
  }
};

// @desc    Send project to admin for review/approval
// @route   POST /api/client/projects/send-to-admin
// @access  Private (Client only)
exports.sendProjectToAdmin = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      projectId,
      projectName,
      message,
      urgency,
      requestType,
      clientInfo
    } = req.body;

    console.log('📨 Sending project to admin');
    console.log('Request data:', req.body);

    // Validation
    if (!projectId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide project ID and message'
      });
    }

    // Find client
    const Client = require('../models/Client');
    const client = await Client.findOne({ userId: userId })
      .populate('userId', 'name email');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    // Verify project belongs to client
    const Project = require('../models/Project');
    const project = await Project.findOne({ _id: projectId, client: client._id });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Create notification/request for admin
    // You can either:
    // 1. Create a Notification model (recommended)
    // 2. Send email to admin
    // 3. Store in project comments/notes
    // 4. Use a dedicated AdminRequest model

    // For now, we'll add to project notes/comments
    if (!project.adminRequests) {
      project.adminRequests = [];
    }

    const adminRequest = {
      requestType: requestType || 'Review',
      urgency: urgency || 'Normal',
      message: message,
      requestedBy: {
        name: client.userId?.name || client.contactPerson?.name,
        email: client.userId?.email || client.contactPerson?.email
      },
      requestedAt: new Date(),
      status: 'Pending'
    };

    // Add to project (you may need to add this field to schema)
    // For now, we'll just log it and send success response

    console.log('Admin Request:', adminRequest);
    console.log('✅ Request prepared for admin');

    // In production, you would:
    // 1. Save to a notifications collection
    // 2. Send email to admin
    // 3. Create a task for admin dashboard

    res.status(200).json({
      success: true,
      message: 'Project request sent to admin successfully. You will be notified once admin reviews it.',
      data: {
        projectId: project._id,
        projectName: project.name,
        requestType: adminRequest.requestType,
        urgency: adminRequest.urgency,
        status: 'Pending Review'
      }
    });

  } catch (error) {
    console.error('❌ Send to admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send request to admin',
      error: error.message
    });
  }
};
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id; // This is the USER ID from JWT

    console.log('📊 Fetching dashboard for user ID:', userId);

    // 1. First, find the client using userId
    const client = await Client.findOne({ userId: userId });

    if (!client) {
      console.log('❌ Client not found for userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    console.log('✅ Client found:', client.clientId);

    // 2. Now get projects using client._id (ObjectId)
    const projects = await Project.find({ client: client._id })
      .select('name status startDate endDate budget progress')
      .lean();

    console.log('📋 Projects found:', projects.length);

    // Count projects by status
    const activeProjects = projects.filter(p =>
      ['In Progress', 'in-progress'].includes(p.status)
    ).length;
    const completedProjects = projects.filter(p =>
      ['Completed', 'completed'].includes(p.status)
    ).length;
    const pendingProjects = projects.filter(p =>
      ['Planning', 'Pending', 'planning'].includes(p.status)
    ).length;
    // Get upcoming meetings - use client._id
    const upcomingMeetings = await Meeting.find({
      participants: client._id,
      scheduledAt: { $gte: new Date() }, // Changed from meetingDate to scheduledAt
      status: { $ne: 'cancelled' }
    })
      .sort({ scheduledAt: 1 }) // Changed from meetingDate
      .limit(5)
      .populate('organizer', 'name email')
      .populate('project', 'name')
      .lean();

    console.log('📅 Upcoming meetings:', upcomingMeetings.length);

    // Calculate total investment and average progress
    const totalInvestment = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const averageProgress = projects.length > 0
      ? projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length
      : 0;

    // Get recent feedback - use client._id
    const recentFeedback = await Project.find({
      client: client._id,
      'feedback.0': { $exists: true }
    })
      .select('name feedback')
      .sort({ 'feedback.createdAt': -1 }) // Changed from submittedAt to createdAt
      .limit(3)
      .lean();

    // Prepare dashboard data
    const dashboardData = {
      stats: {
        totalProjects: projects.length,
        activeProjects,
        completedProjects,
        pendingProjects,
        totalInvestment: totalInvestment.toFixed(2),
        averageProgress: Math.round(averageProgress),
        pendingApprovals: 0, // You can calculate this if you have approval system
        upcomingMeetings: upcomingMeetings.length
      },
      recentProjects: projects.slice(0, 5).map(p => ({
        name: p.name,
        status: p.status,
        progress: p.progress || 0,
        endDate: p.endDate
      })),
      upcomingDeadlines: projects
        .filter(p => p.endDate && new Date(p.endDate) > new Date())
        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
        .slice(0, 5)
        .map(p => ({
          projectName: p.name,
          milestone: 'Project Completion',
          deadline: p.endDate
        })),
      recentUpdates: projects
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 5)
        .map(p => ({
          projectName: p.name,
          description: `Project status updated to ${p.status}`,
          status: p.status,
          date: p.updatedAt || p.createdAt
        }))
    };

    console.log('✅ Dashboard data prepared');

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('❌ Get client dashboard error:', error);
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
    const userId = req.user.id;
    const client = await Client.findOne({ userId });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    const { status, search, sortBy = 'createdAt', order = 'desc' } = req.query;

    // Build query
    const query = { client: client._id };

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
    const userId = req.user.id;

    // Find client by userId reference
    let client = await Client.findOne({ userId: userId })
      .populate('userId', 'name email phone avatar')
      .lean();

    // If client doesn't exist, create one
    if (!client) {
      const User = require('../models/User');
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate unique client ID
      const count = await Client.countDocuments();
      const clientId = `CL${String(count + 1).padStart(4, '0')}`;

      // Create client record
      const newClient = await Client.create({
        userId: userId,
        clientId: clientId,
        companyName: 'Not Set',
        contactPerson: {
          name: user.name,
          email: user.email,
          phone: user.phone || ''
        },
        address: {
          street: '',
          city: '',
          state: '',
          country: '',
          zipCode: ''
        },
        taxInfo: {
          taxId: ''
        },
        isActive: true
      });

      client = await Client.findById(newClient._id)
        .populate('userId', 'name email phone avatar')
        .lean();
    }

    // Flatten the data structure for frontend
    const profileData = {
      _id: client._id,
      clientId: client.clientId,
      name: client.userId?.name || client.contactPerson?.name || '',
      email: client.userId?.email || client.contactPerson?.email || '',
      phone: client.userId?.phone || client.contactPerson?.phone || '',
      avatar: client.userId?.avatar || '',
      companyName: client.companyName || '',
      industry: client.industry || '',
      companySize: client.companySize || '',
      companyWebsite: client.companyWebsite || '',
      website: client.companyWebsite || '', // Alias for frontend
      address: client.address || {
        street: '',
        city: '',
        state: '',
        country: '',
        zipCode: ''
      },
      taxInfo: client.taxInfo || {
        taxId: ''
      }
    };

    res.status(200).json({
      success: true,
      data: profileData
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
    const userId = req.user.id;
    const {
      name,
      email,
      phone,
      avatar,
      companyName,
      industry,
      website,
      companySize,
      address,
      city,
      state,
      zipCode,
      country,
      taxId
    } = req.body;

    // Find client by userId
    let client = await Client.findOne({ userId: userId });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    // Update User model fields
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (user) {
      if (name) user.name = name;
      if (email) user.email = email;
      if (phone) user.phone = phone;
      if (avatar) user.avatar = avatar;
      await user.save();
    }

    // Update Client model fields
    if (companyName !== undefined) client.companyName = companyName;
    if (industry !== undefined) client.industry = industry;
    if (website !== undefined) client.companyWebsite = website;
    if (companySize !== undefined) client.companySize = companySize;

    // Update address - initialize if doesn't exist
    if (!client.address) {
      client.address = {};
    }

    if (address !== undefined) client.address.street = address;
    if (city !== undefined) client.address.city = city;
    if (state !== undefined) client.address.state = state;
    if (zipCode !== undefined) client.address.zipCode = zipCode;
    if (country !== undefined) client.address.country = country;

    // Update tax info - initialize if doesn't exist
    if (!client.taxInfo) {
      client.taxInfo = {};
    }

    if (taxId !== undefined) client.taxInfo.taxId = taxId;

    // Update contact person - initialize if doesn't exist
    if (!client.contactPerson) {
      client.contactPerson = {};
    }

    if (name !== undefined) client.contactPerson.name = name;
    if (email !== undefined) client.contactPerson.email = email;
    if (phone !== undefined) client.contactPerson.phone = phone;

    await client.save();

    // Populate and return updated data
    client = await Client.findById(client._id)
      .populate('userId', 'name email phone avatar')
      .lean();

    // Flatten the data structure
    const profileData = {
      _id: client._id,
      clientId: client.clientId,
      name: client.userId?.name || client.contactPerson?.name || '',
      email: client.userId?.email || client.contactPerson?.email || '',
      phone: client.userId?.phone || client.contactPerson?.phone || '',
      avatar: client.userId?.avatar || '',
      companyName: client.companyName || '',
      industry: client.industry || '',
      companySize: client.companySize || '',
      companyWebsite: client.companyWebsite || '',
      website: client.companyWebsite || '',
      address: client.address || {
        street: '',
        city: '',
        state: '',
        country: '',
        zipCode: ''
      },
      taxInfo: client.taxInfo || {
        taxId: ''
      }
    };

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profileData
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

// @desc    Change password
// @route   PUT /api/client/password
// @access  Private (Client only)
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new password'
      });
    }

    // Get user with password
    const User = require('../models/User');
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// GET /api/client/projects
// FIXED: Client Controller - getMyProjects Function
// Replace your getMyProjects function with this

exports.getMyProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📊 Fetching projects for user:', userId);
    
    // Find the client document using userId
    const client = await Client.findOne({ userId: userId });
    
    if (!client) {
      console.log('❌ Client not found for userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }
    
    console.log('✅ Client found:', client.clientId, client._id);
    
    const { status, search, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    // Build query using client._id (ObjectId)
    const query = { 
      client: client._id,  // ✅ Use client._id, not userId
      isActive: true 
    };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    console.log('🔍 Project query:', query);
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    
    const projects = await Project.find(query)
      .populate('projectManager', 'name email designation')
      .populate('assignedTeam', 'name email role')
      .sort(sortOptions)
      .lean();
    
    console.log(`✅ Found ${projects.length} projects for client`);
    console.log('Project details:', projects.map(p => ({
      id: p._id,
      name: p.name,
      status: p.status,
      priority: p.priority
    })));
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('❌ Get client projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
};



module.exports = exports;