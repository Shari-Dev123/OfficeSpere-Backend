// ============================================
// CLIENT CONTROLLER - COMPLETE & FIXED VERSION
// No Duplicates, All Functions Included
// ============================================

const Client = require('../models/Client');
const Project = require('../models/Project');
const Meeting = require('../models/Meeting');
const DailyReport = require('../models/DailyReport');
const { getIO } = require('../config/socket');
const {
  notifyClientRegistered,
  notifyClientFeedback,
  notifyProjectCreated
} = require('../utils/Notificationhelper');

// ============================================
// HELPER FUNCTIONS
// ============================================

// ✅ Generate unique project ID
const generateProjectId = async () => {
  const prefix = 'PROJ';
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const projectId = `${prefix}-${randomNum}`;
  
  const exists = await Project.findOne({ projectId });
  if (exists) {
    return generateProjectId();
  }
  
  return projectId;
};

// ============================================
// DASHBOARD
// ============================================

// @desc    Get client dashboard data
// @route   GET /api/client/dashboard
// @access  Private (Client only)
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('📊 Fetching dashboard for user ID:', userId);

    // 1. Find the client using userId
    const client = await Client.findOne({ userId: userId });

    if (!client) {
      console.log('❌ Client not found for userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    console.log('✅ Client found:', client.clientId);

    // 2. Get projects using client._id
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

    // Get upcoming meetings
    const upcomingMeetings = await Meeting.find({
      'participants.user': userId,
      startTime: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    })
      .sort({ startTime: 1 })
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

    // Prepare dashboard data
    const dashboardData = {
      stats: {
        totalProjects: projects.length,
        activeProjects,
        completedProjects,
        pendingProjects,
        totalInvestment: totalInvestment.toFixed(2),
        averageProgress: Math.round(averageProgress),
        pendingApprovals: 0,
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

// ============================================
// PROJECT MANAGEMENT
// ============================================

// @desc    Get all client's projects
// @route   GET /api/client/projects
// @access  Private (Client only)
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
    
    // Build query using client._id
    const query = { 
      client: client._id,
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
      .populate('projectManager', 'name email')
      .populate('team.employee', 'name email')
      .populate('files.uploadedBy', 'name email')
      .populate('feedback.submittedBy', 'name email')
      .sort(sortOptions)
      .lean();
    
    console.log(`✅ Found ${projects.length} projects for client`);
    
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

// @desc    Get single project details
// @route   GET /api/client/projects/:id
// @access  Private (Client only)
exports.getProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find client
    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    const project = await Project.findOne({ 
      _id: id, 
      client: client._id 
    })
      .populate('projectManager', 'name email')
      .populate('team.employee', 'name email')
      .populate('files.uploadedBy', 'name email')
      .populate('feedback.submittedBy', 'name email')
      .populate('feedback.respondedBy', 'name email')
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

// @desc    Create new project (WITH FILES)
// @route   POST /api/client/projects
// @access  Private (Client only)
exports.createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      startDate,
      endDate,
      budget,
      priority,
      tags,
      requirements
    } = req.body;

    console.log('📝 Client creating project:', req.body);

    const userId = req.user.id;

    // Find client
    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Validation
    if (!name || !description || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, description, start date, and end date'
      });
    }

    // Generate unique projectId
    const projectId = await generateProjectId();
    console.log('🔑 Generated projectId:', projectId);

    // ✅ Handle file uploads
    let uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      uploadedFiles = req.files.map(file => ({
        name: file.originalname,
        url: `/uploads/projects/${file.filename}`,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      }));
      console.log('📎 Files uploaded by client:', uploadedFiles.length);
    }

    // Create project
    const project = await Project.create({
      projectId,
      name,
      description,
      client: client._id,
      startDate,
      endDate,
      budget: budget || 0,
      status: 'Planning',
      priority: priority || 'Medium',
      tags: tags || [],
      files: uploadedFiles,
      progress: 0,
      spent: 0,
      adminRequests: [{
        requestType: 'Review',
        urgency: 'Normal',
        message: requirements || 'New project request from client',
        requestedBy: {
          name: client.contactPerson?.name || client.companyName,
          email: client.contactPerson?.email || client.email
        },
        requestedAt: new Date(),
        status: 'Pending'
      }]
    });

    console.log('✅ Project created by client:', project._id);

    // Populate project data
    await project.populate([
      { path: 'client', select: 'name companyName email' },
      { path: 'files.uploadedBy', select: 'name email' }
    ]);

    // Notify admin
    try {
      await notifyProjectCreated({
        projectId: project._id,
        name: project.name,
        clientId: project.client._id,
        clientName: project.client.companyName || project.client.name,
        status: 'Planning',
        startDate: project.startDate,
        createdBy: 'client'
      });
      console.log('📧 Admin notification sent');
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

    // Emit socket event
    try {
      const io = getIO();
      io.to('admin').emit('project-request', {
        project: {
          _id: project._id,
          projectId: project.projectId,
          name: project.name,
          client: project.client,
          status: 'Planning',
          requestedAt: new Date()
        }
      });
      console.log('📡 Project request event emitted to admin');
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(201).json({
      success: true,
      message: 'Project request submitted successfully. Waiting for admin approval.',
      data: project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating project',
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

    // Find client
    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    // Find project
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

    // Update tags if provided
    if (updateData.tags) {
      project.tags = updateData.tags;
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

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
      });
    }

    const project = await Project.findOne({ _id: id, client: client._id });
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Check if project can be deleted
    if (project.status === 'In Progress' || project.status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete project with status: ${project.status}`
      });
    }

    // Soft delete
    project.isActive = false;
    await project.save();

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

// @desc    Upload files to project
// @route   POST /api/client/projects/:id/upload
// @access  Private (Client only)
exports.uploadProjectFiles = async (req, res) => {
  try {
    const userId = req.user.id;

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      client: client._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one file'
      });
    }

    const newFiles = req.files.map(file => ({
      name: file.originalname,
      url: `/uploads/projects/${file.filename}`,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    }));

    project.files = [...project.files, ...newFiles];
    await project.save();

    await project.populate('files.uploadedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `${newFiles.length} file(s) uploaded successfully`,
      data: project.files
    });
  } catch (error) {
    console.error('Upload files error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading files',
      error: error.message
    });
  }
};

// @desc    Get project progress
// @route   GET /api/client/projects/:id/progress
// @access  Private (Client only)
exports.getProjectProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({
      _id: id,
      client: client._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        progress: project.progress,
        status: project.status,
        milestones: project.milestones,
        deliverables: project.deliverables
      }
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching progress',
      error: error.message
    });
  }
};

// @desc    Get project timeline
// @route   GET /api/client/projects/:id/timeline
// @access  Private (Client only)
exports.getProjectTimeline = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({ _id: id, client: client._id })
      .select('name milestones createdAt')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const timeline = [];

    // Add milestones
    if (project.milestones) {
      project.milestones.forEach(milestone => {
        timeline.push({
          type: 'milestone',
          title: milestone.name,
          description: milestone.description,
          date: milestone.dueDate,
          status: milestone.status,
          completedAt: milestone.completedAt
        });
      });
    }

    // Sort by date
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
    const userId = req.user.id;
    const { id } = req.params;

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({ _id: id, client: client._id })
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

// @desc    Send project to admin
// @route   POST /api/client/projects/:id/send-to-admin
// @access  Private (Client only)
exports.sendToAdmin = async (req, res) => {
  try {
    const {
      requestType,
      urgency,
      message
    } = req.body;

    const userId = req.user.id;

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      client: client._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Add admin request
    const adminRequest = {
      requestType: requestType || 'Review',
      urgency: urgency || 'Normal',
      message,
      requestedBy: {
        name: client.contactPerson?.name || client.companyName,
        email: client.contactPerson?.email || client.email
      },
      requestedAt: new Date(),
      status: 'Pending'
    };

    project.adminRequests.push(adminRequest);
    await project.save();

    // Notify admin
    try {
      const io = getIO();
      io.to('admin').emit('admin-request', {
        projectId: project._id,
        projectName: project.name,
        request: adminRequest
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Request sent to admin successfully',
      data: adminRequest
    });
  } catch (error) {
    console.error('Send to admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending request to admin',
      error: error.message
    });
  }
};

// ============================================
// FEEDBACK
// ============================================

// @desc    Submit feedback
// @route   POST /api/client/projects/:id/feedback
// @access  Private (Client only)
exports.submitFeedback = async (req, res) => {
  try {
    const {
      type,
      subject,
      message,
      rating,
      satisfactionLevel
    } = req.body;

    const userId = req.user.id;

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      client: client._id
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Validation
    if (!subject || !message || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Subject, message, and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Add feedback
    const feedback = {
      type: type || 'general',
      subject,
      message,
      rating,
      satisfactionLevel: satisfactionLevel || 5,
      submittedBy: client._id,
      submittedAt: new Date(),
      status: 'Pending'
    };

    project.feedback.push(feedback);
    await project.save();

    await project.populate('feedback.submittedBy', 'name email');

    // Notify admin
    try {
      const io = getIO();
      io.to('admin').emit('feedback-received', {
        projectId: project._id,
        projectName: project.name,
        feedback: feedback
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: project.feedback[project.feedback.length - 1]
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback',
      error: error.message
    });
  }
};

// @desc    Get feedback history
// @route   GET /api/client/projects/:id/feedback
// @access  Private (Client only)
exports.getFeedbackHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({ _id: id, client: client._id })
      .select('name feedback')
      .populate('feedback.submittedBy', 'name email')
      .populate('feedback.respondedBy', 'name email')
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

// ============================================
// MEETINGS
// ============================================

// @desc    Get client's meetings
// @route   GET /api/client/meetings
// @access  Private (Client only)
exports.getMyMeetings = async (req, res) => {
  try {
    console.log('📅 FETCHING CLIENT MEETINGS');
    const userId = req.user.id;
    const { status, upcoming } = req.query;

    const query = { 
      'participants.user': userId
    };

    if (status) {
      query.status = status;
    }

    if (upcoming === 'true') {
      query.startTime = { $gte: new Date() };
      query.status = { $ne: 'cancelled' };
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email role')
      .populate('project', 'name')
      .sort({ startTime: upcoming === 'true' ? 1 : -1 })
      .lean();

    console.log(`✅ Found ${meetings.length} meetings for client`);

    res.status(200).json({
      success: true,
      count: meetings.length,
      meetings
    });
    
  } catch (error) {
    console.error('❌ GET CLIENT MEETINGS ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meetings',
      error: error.message
    });
  }
};

// @desc    Get single meeting
// @route   GET /api/client/meetings/:id
// @access  Private (Client only)
exports.getMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const meeting = await Meeting.findOne({
      _id: id,
      'participants.user': userId
    })
      .populate('organizer', 'name email')
      .populate('participants.user', 'name email role avatar')
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
    console.error('❌ Get meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meeting',
      error: error.message
    });
  }
};

// ============================================
// PROFILE MANAGEMENT
// ============================================

// @desc    Get client profile
// @route   GET /api/client/profile
// @access  Private (Client only)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

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

      const count = await Client.countDocuments();
      const clientId = `CL${String(count + 1).padStart(4, '0')}`;

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

    // Flatten data structure
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
    
    console.log('📝 UPDATE CLIENT PROFILE');
    console.log('User ID:', userId);

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

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Find client
    let client = await Client.findOne({ userId: userId });

    if (!client) {
      console.log('❌ Client not found, creating new client...');
      
      const count = await Client.countDocuments();
      const clientId = `CL${String(count + 1).padStart(4, '0')}`;
      
      client = await Client.create({
        userId: userId,
        clientId: clientId,
        companyName: companyName?.trim() || 'Not Set',
        contactPerson: {
          name: name.trim(),
          email: email.trim(),
          phone: phone?.trim() || ''
        },
        address: {
          street: address?.trim() || '',
          city: city?.trim() || '',
          state: state?.trim() || '',
          country: country?.trim() || '',
          zipCode: zipCode?.trim() || ''
        },
        taxInfo: {
          taxId: taxId?.trim() || ''
        },
        isActive: true
      });
      
      console.log('✅ New client created:', client.clientId);
    }

    // Update User model
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check email uniqueness
    if (email.trim() !== user.email) {
      const existingUser = await User.findOne({ 
        email: email.trim(),
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }

      user.email = email.trim();
    }

    user.name = name.trim();
    if (phone !== undefined) user.phone = phone?.trim() || '';
    if (avatar !== undefined) user.avatar = avatar?.trim() || '';
    
    await user.save();

    // Update Client model
    if (companyName !== undefined) client.companyName = companyName?.trim() || '';
    if (industry !== undefined) client.industry = industry?.trim() || '';
    if (website !== undefined) client.companyWebsite = website?.trim() || '';
    if (companySize !== undefined) client.companySize = companySize?.trim() || '';

    // Initialize address if needed
    if (!client.address) {
      client.address = {
        street: '',
        city: '',
        state: '',
        country: '',
        zipCode: ''
      };
    }

    if (address !== undefined) client.address.street = address?.trim() || '';
    if (city !== undefined) client.address.city = city?.trim() || '';
    if (state !== undefined) client.address.state = state?.trim() || '';
    if (zipCode !== undefined) client.address.zipCode = zipCode?.trim() || '';
    if (country !== undefined) client.address.country = country?.trim() || '';

    // Initialize taxInfo if needed
    if (!client.taxInfo) {
      client.taxInfo = { taxId: '' };
    }

    if (taxId !== undefined) client.taxInfo.taxId = taxId?.trim() || '';

    // Initialize contactPerson if needed
    if (!client.contactPerson) {
      client.contactPerson = { name: '', email: '', phone: '' };
    }

    client.contactPerson.name = name.trim();
    client.contactPerson.email = email.trim();
    if (phone !== undefined) client.contactPerson.phone = phone?.trim() || '';

    await client.save();

    // Populate and return
    client = await Client.findById(client._id)
      .populate('userId', 'name email phone avatar')
      .lean();

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

    console.log('✅ PROFILE UPDATE SUCCESSFUL');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profileData
    });
  } catch (error) {
    console.error('❌ UPDATE PROFILE ERROR:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
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

    const User = require('../models/User');
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

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

// @desc    Approve milestone
// @route   POST /api/client/projects/:id/milestones/:milestoneId/approve
// @access  Private (Client only)
exports.approveMilestone = async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    const userId = req.user.id;

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({ _id: id, client: client._id });

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

    milestone.status = 'Approved';
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

// @desc    Request changes
// @route   POST /api/client/projects/:id/milestones/:milestoneId/changes
// @access  Private (Client only)
exports.requestChanges = async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    const userId = req.user.id;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide change request details'
      });
    }

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({ _id: id, client: client._id });

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

    milestone.status = 'Needs Changes';
    milestone.feedback = comment;

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

// @desc    Rate satisfaction
// @route   POST /api/client/projects/:id/rating
// @access  Private (Client only)
exports.rateSatisfaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { overallRating, comments } = req.body;

    if (!overallRating) {
      return res.status(400).json({
        success: false,
        message: 'Please provide overall rating'
      });
    }

    const client = await Client.findOne({ userId: userId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const project = await Project.findOne({ _id: id, client: client._id });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    project.clientRating = {
      overall: overallRating,
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