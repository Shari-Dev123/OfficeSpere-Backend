// Project Controller - WITH FILE UPLOAD SUPPORT
// Admin can upload files when creating/completing projects
// Client can upload files when creating projects
// ============================================

const Project = require('../models/Project');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const Task = require('../models/Task');
const { getIO } = require('../config/socket');
const {
  notifyProjectCreated,
  notifyProjectUpdated,
  notifyProjectCompleted
} = require('../utils/Notificationhelper.js');

// ✅ Helper function to generate unique projectId
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

// @desc    Get all projects (Admin)
// @route   GET /api/admin/projects
// @access  Private/Admin
exports.getProjects = async (req, res) => {
  try {
    const { search, status, client, page = 1, limit = 10 } = req.query;

    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (client) {
      query.client = client;
    }

    const skip = (page - 1) * limit;
    const total = await Project.countDocuments(query);

    const projects = await Project.find(query)
      .populate('client', 'name companyName email')
      .populate({
        path: 'projectManager',
        select: 'name email userId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate({
        path: 'team.employee',
        select: 'name email userId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('files.uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: projects.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      projects: projects // ✅ Changed from 'data' to 'projects'
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects',
      error: error.message
    });
  }
};

// @desc    Get single project
// @route   GET /api/admin/projects/:id
// @access  Private/Admin
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client', 'name companyName email phone')
      .populate({
        path: 'projectManager',
        select: 'name email userId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate({
        path: 'team.employee',
        select: 'name email userId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('files.uploadedBy', 'name email');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const tasks = await Task.find({ project: project._id })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        project,
        tasks,
        stats: {
          totalTasks,
          completedTasks,
          progress
        }
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project',
      error: error.message
    });
  }
};

// @desc    Create new project (Admin)
// @route   POST /api/admin/projects
// @access  Private/Admin
exports.createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      client,
      projectManager,
      startDate,
      endDate,
      budget,
      status,
      priority,
      tags
    } = req.body;

    console.log('📝 Creating project with data:', req.body);

    // ✅ Generate unique projectId
    const projectId = await generateProjectId();
    console.log('🔑 Generated projectId:', projectId);

    // Verify client exists
    const clientExists = await Client.findById(client);
    if (!clientExists) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Verify project manager exists (if provided)
    if (projectManager) {
      const pmExists = await Employee.findById(projectManager);
      if (!pmExists) {
        return res.status(404).json({
          success: false,
          message: 'Project manager not found'
        });
      }
    }

    // ✅ Handle file uploads (if any)
    let uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      uploadedFiles = req.files.map(file => ({
        name: file.originalname,
        url: `/uploads/projects/${file.filename}`,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      }));
      console.log('📎 Files uploaded:', uploadedFiles.length);
    }

    // ✅ Create project with files
    const project = await Project.create({
      projectId,
      name,
      description,
      client,
      projectManager,
      startDate,
      endDate,
      budget,
      status: status || 'Planning',
      priority: priority || 'Medium',
      tags: tags || [],
      files: uploadedFiles, // ✅ Add files
      progress: 0,
      spent: 0
    });

    console.log('✅ Project created:', project._id);

    // Populate project data
    await project.populate([
      { path: 'client', select: 'name companyName email' },
      { 
        path: 'projectManager', 
        select: 'name email userId',
        populate: { path: 'userId', select: 'name email' }
      },
      { path: 'files.uploadedBy', select: 'name email' }
    ]);

    // ✅ Send notifications
    try {
      await notifyProjectCreated({
        projectId: project._id,
        name: project.name,
        clientId: project.client?._id,
        clientName: project.client?.companyName || project.client?.name,
        status: project.status,
        startDate: project.startDate
      });
      console.log('📧 Notification sent');
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

    // ✅ EMIT SOCKET EVENTS
    try {
      const io = getIO();
      
      if (project.projectManager) {
        io.to(`employee-${project.projectManager._id}`).emit('project-assigned', {
          project: {
            _id: project._id,
            projectId: project.projectId,
            name: project.name,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate,
            status: project.status
          }
        });
      }

      if (project.client) {
        io.to(`client-${project.client._id}`).emit('project-created', {
          project: {
            _id: project._id,
            projectId: project.projectId,
            name: project.name,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate
          }
        });
      }

      io.to('admin').emit('project-created', { project });
      
      console.log('📡 Project creation events emitted');
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
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

// @desc    Update project (Admin)
// @route   PUT /api/admin/projects/:id
// @access  Private/Admin
exports.updateProject = async (req, res) => {
  try {
    console.log('🔄 UPDATE PROJECT');
    console.log('📝 Project ID:', req.params.id);
    console.log('📊 Update data:', req.body);
    
    let project = await Project.findById(req.params.id);

    if (!project) {
      console.log('❌ Project not found');
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Update fields
    const allowedFields = [
      'name',
      'description',
      'startDate',
      'endDate',
      'budget',
      'status',
      'priority',
      'projectManager',
      'tags'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    });

    // ✅ Handle file uploads (if any)
    if (req.files && req.files.length > 0) {
      const newFiles = req.files.map(file => ({
        name: file.originalname,
        url: `/uploads/projects/${file.filename}`,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      }));
      
      project.files = [...project.files, ...newFiles];
      console.log('📎 New files added:', newFiles.length);
    }

    // Update timestamps
    if (req.body.status === 'In Progress' && !project.actualStartDate) {
      project.actualStartDate = new Date();
    }

    if (req.body.status === 'Completed' && !project.actualEndDate) {
      project.actualEndDate = new Date();
    }

    await project.save();
    console.log('✅ Project saved');

    // Populate updated project
    const updatedProject = await Project.findById(project._id)
      .populate('client', 'name companyName email')
      .populate({
        path: 'projectManager',
        select: 'name email userId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('files.uploadedBy', 'name email');
    
    console.log('✅ Project populated');

    // ✅ Send notifications
    try {
      await notifyProjectUpdated({
        projectId: updatedProject._id,
        name: updatedProject.name,
        clientId: updatedProject.client?._id,
        status: updatedProject.status,
        changes: Object.keys(req.body)
      });
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

    // ✅ EMIT SOCKET EVENTS
    try {
      const io = getIO();
      
      if (updatedProject.projectManager) {
        io.to(`employee-${updatedProject.projectManager._id}`).emit('project-updated', {
          project: {
            _id: updatedProject._id,
            projectId: updatedProject.projectId,
            name: updatedProject.name,
            status: updatedProject.status,
            endDate: updatedProject.endDate
          }
        });
      }

      if (updatedProject.client) {
        io.to(`client-${updatedProject.client._id}`).emit('project-updated', {
          project: updatedProject
        });
      }

      io.to('admin').emit('project-updated', { project: updatedProject });
      
      console.log('📡 Project update events emitted');
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    });
  } catch (error) {
    console.error('❌ Update project error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error updating project',
      error: error.message
    });
  }
};

// @desc    Upload files to project (Admin/Client)
// @route   POST /api/admin/projects/:id/upload
// @access  Private
exports.uploadProjectFiles = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

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

// @desc    Delete project
// @route   DELETE /api/admin/projects/:id
// @access  Private/Admin
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const taskCount = await Task.countDocuments({ project: project._id });
    if (taskCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete project with existing tasks. Please delete tasks first.'
      });
    }

    await project.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting project',
      error: error.message
    });
  }
};

// @desc    Assign team to project
// @route   POST /api/admin/projects/:id/assign
// @access  Private/Admin
exports.assignTeam = async (req, res) => {
  try {
    const { teamMembers } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (teamMembers && teamMembers.length > 0) {
      const employees = await Employee.find({ _id: { $in: teamMembers } });
      if (employees.length !== teamMembers.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more team members not found'
        });
      }
    }

    project.team = teamMembers.map(empId => ({
      employee: empId,
      role: 'Developer',
      assignedAt: new Date()
    }));
    
    await project.save();

    await project.populate({
      path: 'team.employee',
      select: 'name email userId',
      populate: { path: 'userId', select: 'name email' }
    });

    res.status(200).json({
      success: true,
      message: 'Team assigned successfully',
      data: project
    });
  } catch (error) {
    console.error('Assign team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning team',
      error: error.message
    });
  }
};

// @desc    Get project timeline
// @route   GET /api/admin/projects/:id/timeline
// @access  Private/Admin
exports.getProjectTimeline = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const tasks = await Task.find({ project: project._id })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: 1 });

    const timeline = {
      project: {
        name: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        actualStartDate: project.actualStartDate,
        actualEndDate: project.actualEndDate,
        status: project.status
      },
      tasks: tasks.map(task => ({
        id: task._id,
        title: task.title,
        assignedTo: task.assignedTo?.name,
        startDate: task.createdAt,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        status: task.status,
        priority: task.priority
      })),
      milestones: project.milestones || []
    };

    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project timeline',
      error: error.message
    });
  }
};

// @desc    Get project statistics
// @route   GET /api/admin/projects/:id/stats
// @access  Private/Admin
exports.getProjectStats = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const tasks = await Task.find({ project: project._id });
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const overdueTasks = tasks.filter(t =>
      t.status !== 'completed' && new Date(t.dueDate) < new Date()
    ).length;

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const now = new Date();
    const projectDuration = project.endDate - project.startDate;
    const elapsed = now - project.startDate;
    const timeProgress = Math.min(Math.round((elapsed / projectDuration) * 100), 100);
    const daysRemaining = Math.ceil((project.endDate - now) / (1000 * 60 * 60 * 24));

    const budgetUsed = project.spent || 0;
    const budgetProgress = project.budget > 0 ? Math.round((budgetUsed / project.budget) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          inProgress: inProgressTasks,
          pending: pendingTasks,
          overdue: overdueTasks
        },
        progress: {
          overall: progress,
          time: timeProgress,
          budget: budgetProgress
        },
        timeline: {
          startDate: project.startDate,
          endDate: project.endDate,
          daysRemaining,
          status: project.status
        },
        budget: {
          total: project.budget,
          used: budgetUsed,
          remaining: project.budget - budgetUsed
        },
        team: {
          size: project.team?.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project statistics',
      error: error.message
    });
  }
};