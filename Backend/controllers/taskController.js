// ============================================
// Task Controller
// Handles all task-related operations
// ============================================

const Task = require('../models/Task');
const Project = require('../models/Project');
const Employee = require('../models/Employee');
const { getIO } = require('../config/socket');

// @desc    Get all tasks
// @route   GET /api/admin/tasks
// @access  Private/Admin
exports.getTasks = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      priority, 
      project, 
      assignedTo, 
      page = 1, 
      limit = 10 
    } = req.query;

    // Build query
    let query = {};

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (project) {
      query.project = project;
    }

    if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    // Pagination
    const skip = (page - 1) * limit;
    const total = await Task.countDocuments(query);

    const tasks = await Task.find(query)
      .populate('project', 'name')
      .populate('assignedTo', 'name email department')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: tasks.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: tasks
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message
    });
  }
};

// @desc    Get single task
// @route   GET /api/admin/tasks/:id
// @access  Private/Admin
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', 'name status')
      .populate('assignedTo', 'name email department designation')
      .populate('createdBy', 'name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching task',
      error: error.message
    });
  }
};

// @desc    Create new task
// @route   POST /api/admin/tasks
// @access  Private/Admin
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      project,
      assignedTo,
      priority,
      status,
      dueDate,
      estimatedHours
    } = req.body;

    // Verify project exists (if provided)
    if (project) {
      const projectExists = await Project.findById(project);
      if (!projectExists) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
    }

    // Verify assigned employee exists
    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Please assign this task to an employee'
      });
    }

    const employeeExists = await Employee.findById(assignedTo);
    if (!employeeExists) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Create task with assignedBy and createdBy
    const taskData = {
      title,
      description,
      assignedTo,
      priority: priority || 'medium',
      status: status || 'pending',
      dueDate,
      estimatedHours: estimatedHours || 0,
      assignedBy: req.user.id, // ✅ Admin who created the task
      createdBy: req.user.id    // ✅ Admin who created the task
    };

    // Only add project if provided
    if (project) {
      taskData.project = project;
    }

    const task = await Task.create(taskData);

    // Populate task data
    await task.populate('project', 'name');
    await task.populate('assignedTo', 'name email');
    await task.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating task',
      error: error.message
    });
  }
};

// @desc    Update task
// @route   PUT /api/admin/tasks/:id
// @access  Private/Admin
exports.updateTask = async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Update fields
    const allowedFields = [
      'title',
      'description',
      'priority',
      'status',
      'dueDate',
      'estimatedHours',
      'assignedTo'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    // Update status timestamps
    if (req.body.status === 'in-progress' && task.status !== 'in-progress') {
      task.startedAt = new Date();
    }

    if (req.body.status === 'completed' && task.status !== 'completed') {
      task.completedAt = new Date();
    }

    await task.save();

    // Populate task data
    await task.populate('project', 'name');
    await task.populate('assignedTo', 'name email');
    await task.populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating task',
      error: error.message
    });
  }
};

// @desc    Delete task
// @route   DELETE /api/admin/tasks/:id
// @access  Private/Admin
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await task.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting task',
      error: error.message
    });
  }
};

// @desc    Assign task to employee
// @route   POST /api/admin/tasks/:id/assign
// @access  Private/Admin
exports.assignTask = async (req, res) => {
  try {
    const { employeeId } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Assign task
    task.assignedTo = employeeId;
    await task.save();

    // Populate task data
    await task.populate('assignedTo', 'name email department');

    res.status(200).json({
      success: true,
      message: 'Task assigned successfully',
      data: task
    });
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning task',
      error: error.message
    });
  }
};

// @desc    Get task statistics
// @route   GET /api/admin/tasks/stats
// @access  Private/Admin
exports.getTaskStats = async (req, res) => {
  try {
    const totalTasks = await Task.countDocuments();
    const pendingTasks = await Task.countDocuments({ status: 'pending' });
    const inProgressTasks = await Task.countDocuments({ status: 'in-progress' });
    const completedTasks = await Task.countDocuments({ status: 'completed' });
    
    const highPriorityTasks = await Task.countDocuments({ priority: 'high' });
    const mediumPriorityTasks = await Task.countDocuments({ priority: 'medium' });
    const lowPriorityTasks = await Task.countDocuments({ priority: 'low' });

    // Get overdue tasks
    const overdueTasks = await Task.countDocuments({
      status: { $ne: 'completed' },
      dueDate: { $lt: new Date() }
    });

    // Get tasks due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasksDueToday = await Task.countDocuments({
      status: { $ne: 'completed' },
      dueDate: { $gte: today, $lt: tomorrow }
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalTasks,
        byStatus: {
          pending: pendingTasks,
          inProgress: inProgressTasks,
          completed: completedTasks
        },
        byPriority: {
          high: highPriorityTasks,
          medium: mediumPriorityTasks,
          low: lowPriorityTasks
        },
        overdue: overdueTasks,
        dueToday: tasksDueToday
      }
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching task statistics',
      error: error.message
    });
  }
};

// @desc    Bulk update tasks
// @route   PUT /api/admin/tasks/bulk
// @access  Private/Admin
exports.bulkUpdateTasks = async (req, res) => {
  try {
    const { taskIds, updates } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Task IDs array is required'
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates object is required'
      });
    }

    // Perform bulk update
    const result = await Task.updateMany(
      { _id: { $in: taskIds } },
      { $set: updates }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} tasks updated successfully`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Bulk update tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating tasks',
      error: error.message
    });
  }
};

// @desc    Get tasks by project
// @route   GET /api/admin/tasks/project/:projectId
// @access  Private/Admin
exports.getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get all tasks for this project
    const tasks = await Task.find({ project: projectId })
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        project: {
          id: project._id,
          name: project.name
        },
        tasks,
        stats: {
          total: totalTasks,
          completed: completedTasks,
          progress
        }
      }
    });
  } catch (error) {
    console.error('Get tasks by project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project tasks',
      error: error.message
    });
  }
};

// @desc    Get tasks by employee
// @route   GET /api/admin/tasks/employee/:employeeId
// @access  Private/Admin
exports.getTasksByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get all tasks for this employee
    const tasks = await Task.find({ assignedTo: employeeId })
      .populate('project', 'name')
      .sort({ dueDate: 1 });

    // Calculate statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const overdueTasks = tasks.filter(t => 
      t.status !== 'completed' && new Date(t.dueDate) < new Date()
    ).length;

    res.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          name: employee.name
        },
        tasks,
        stats: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks,
          inProgress: inProgressTasks,
          overdue: overdueTasks
        }
      }
    });
  } catch (error) {
    console.error('Get tasks by employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee tasks',
      error: error.message
    });
  }
};

exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      project,
      assignedTo,
      priority,
      dueDate,
      estimatedHours
    } = req.body;

    // ... your existing validation code ...

    // Create task
    const task = await Task.create({
      title,
      description,
      project,
      assignedTo,
      priority: priority || 'medium',
      status: 'pending',
      dueDate,
      estimatedHours,
      createdBy: req.user.id
    });

    // Populate task data
    await task.populate('project', 'name');
    await task.populate('assignedTo', 'name email');
    await task.populate('createdBy', 'name email');

    // ✅ EMIT SOCKET EVENT
    try {
      const io = getIO();
      
      // Notify assigned employee
      if (task.assignedTo) {
        io.to(`employee-${task.assignedTo._id}`).emit('task-assigned', {
          task: {
            _id: task._id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate,
            status: task.status
          },
          assignedBy: req.user.name || 'Admin'
        });
      }
      
      // Notify all admins
      io.to('admin').emit('task-created', {
        task,
        employeeId: task.assignedTo?._id,
        employeeName: task.assignedTo?.name
      });
      
      console.log('📡 Task assigned event emitted');
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating task',
      error: error.message
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Update fields
    const allowedFields = [
      'title',
      'description',
      'priority',
      'status',
      'dueDate',
      'estimatedHours',
      'assignedTo'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    // Update status timestamps
    if (req.body.status === 'in-progress' && task.status !== 'in-progress') {
      task.startedAt = new Date();
    }

    if (req.body.status === 'completed' && task.status !== 'completed') {
      task.completedAt = new Date();
    }

    await task.save();

    // Populate task data
    await task.populate('project', 'name');
    await task.populate('assignedTo', 'name email');
    await task.populate('createdBy', 'name email');

    // ✅ EMIT SOCKET EVENT
    try {
      const io = getIO();
      io.to('admin').emit('task-updated', {
        taskId: task._id,
        title: task.title,
        status: task.status,
        employeeName: task.assignedTo?.name,
        employeeId: task.assignedTo?._id
      });
      console.log('📡 Task update event emitted to admins');
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating task',
      error: error.message
    });
  }
};