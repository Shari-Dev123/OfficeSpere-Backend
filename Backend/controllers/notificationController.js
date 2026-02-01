// controllers/notificationController.js
const Notification = require('../models/Notification');

// ==================== ADMIN NOTIFICATIONS ====================

// GET all admin notifications
exports.getAdminNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ role: 'admin' })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// ==================== CLIENT NOTIFICATIONS ====================

// GET all client notifications
exports.getClientNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ role: 'client' })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching client notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// ==================== SHARED FUNCTIONS ====================

// MARK as read
exports.markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    
    res.json({ 
      success: true,
      message: 'Marked as read' 
    });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as read'
    });
  }
};

// MARK as unread
exports.markAsUnread = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: false });
    
    res.json({ 
      success: true,
      message: 'Marked as unread' 
    });
  } catch (error) {
    console.error('Error marking as unread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark as unread'
    });
  }
};

// MARK ALL as read
exports.markAllRead = async (req, res) => {
  try {
    // Determine role from the route
    const role = req.baseUrl.includes('/admin') ? 'admin' : 'client';
    
    await Notification.updateMany({ role }, { isRead: true });
    
    res.json({ 
      success: true,
      message: 'All marked as read' 
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all as read'
    });
  }
};

// DELETE one
exports.deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    
    res.json({ 
      success: true,
      message: 'Deleted' 
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// DELETE many (admin only)
exports.deleteMany = async (req, res) => {
  try {
    await Notification.deleteMany({ _id: { $in: req.body.ids } });
    
    res.json({ 
      success: true,
      message: 'Deleted selected notifications' 
    });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notifications'
    });
  }
};

// ==================== HELPER FUNCTIONS ====================

// Create notification
exports.createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    console.log(`📬 Notification created for ${data.role}:`, data.title);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};