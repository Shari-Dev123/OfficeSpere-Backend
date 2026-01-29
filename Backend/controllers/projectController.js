// ============================================
// Project Controller
// Handles all project-related operations
// ============================================

const Project = require('../models/Project');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const Task = require('../models/Task');

// @desc    Get all projects
// @route   GET /api/admin/projects
// @access  Private/Admin
exports.getProjects = async (req, res) => {
  try {
    const { search, status, client, page = 1, limit = 10 } = req.query;

    // Build query
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

    // Pagination
    const skip = (page - 1) * limit;
    const total = await Project.countDocuments(query);

    const projects = await Project.find(query)
      .populate('client', 'name companyName email')
      .populate({
        path: 'team',
        select: 'name email department designation',
        match: { isActive: true } // only active employees
      })
      .populate({
        path: 'client',
        select: 'name companyName email',
        match: { isActive: true } // only active clients
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: projects.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: projects
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
      .populate('team', 'name email department designation')
      .populate('createdBy', 'name email');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get project tasks
    const tasks = await Task.find({ project: project._id })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    // Calculate progress
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

// @desc    Create new project
// @route   POST /api/admin/projects
// @access  Private/Admin
exports.createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      client,
      startDate,
      endDate,
      budget,
      team,
      status,
      priority
    } = req.body;

    // Verify client exists
    const clientExists = await Client.findById(client);
    if (!clientExists) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Verify team members exist (if provided)
    if (team && team.length > 0) {
      const teamMembers = await Employee.find({ _id: { $in: team } });
      if (teamMembers.length !== team.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more team members not found'
        });
      }
    }

    // Create project
    const project = await Project.create({
      name,
      description,
      client,
      startDate,
      endDate,
      budget,
      team: team || [],
      status: status || 'planning',
      priority: priority || 'medium',
      createdBy: req.user.id
    });

    // Populate project data
    await project.populate('client', 'name companyName email');
    await project.populate('team', 'name email department');
    await project.populate('createdBy', 'name email');

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

// @desc    Update project
// @route   PUT /api/admin/projects/:id
// @access  Private/Admin
// @desc    Update project
// @route   PUT /api/admin/projects/:id
// @access  Private/Admin
exports.updateProject = async (req, res) => {
  try {
    console.log('====================================');
    console.log('🔄 UPDATE PROJECT');
    console.log('====================================');
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
      'team'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    });

    // Update timestamps
    if (req.body.status === 'in-progress' && !project.actualStartDate) {
      project.actualStartDate = new Date();
    }

    if (req.body.status === 'completed' && !project.actualEndDate) {
      project.actualEndDate = new Date();
    }

    await project.save();
    console.log('✅ Project saved');

    // ✅ CRITICAL FIX: Only populate fields that exist in schema
    const updatedProject = await Project.findById(project._id)
      .populate('client', 'companyName email contactPerson')
      .populate('team', 'name email designation');
    
    console.log('✅ Project populated');
    console.log('====================================');

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    });
  } catch (error) {
    console.error('====================================');
    console.error('❌ Update project error:', error);
    console.error('Error message:', error.message);
    console.error('====================================');
    
    res.status(500).json({
      success: false,
      message: 'Error updating project',
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

    // Check if project has tasks
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

    // Verify team members exist
    if (teamMembers && teamMembers.length > 0) {
      const employees = await Employee.find({ _id: { $in: teamMembers } });
      if (employees.length !== teamMembers.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more team members not found'
        });
      }
    }

    // Update team
    project.team = teamMembers;
    await project.save();

    // Populate team data
    await project.populate('team', 'name email department designation');

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

    // Get project tasks with timeline
    const tasks = await Task.find({ project: project._id })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: 1 });

    // Build timeline
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

    // Get task statistics
    const tasks = await Task.find({ project: project._id });
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const overdueTasks = tasks.filter(t =>
      t.status !== 'completed' && new Date(t.dueDate) < new Date()
    ).length;

    // Calculate progress
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate time metrics
    const now = new Date();
    const projectDuration = project.endDate - project.startDate;
    const elapsed = now - project.startDate;
    const timeProgress = Math.min(Math.round((elapsed / projectDuration) * 100), 100);
    const daysRemaining = Math.ceil((project.endDate - now) / (1000 * 60 * 60 * 24));

    // Budget tracking
    const budgetUsed = 0; // You would calculate this from time tracking or expenses
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
          size: project.team.length
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