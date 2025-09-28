// Mobile Sidebar Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
  const sidebarToggle = document.querySelector('.sidebar-toggle-mobile');
  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  
  if (sidebarToggle && sidebar) {
    // Create overlay if it doesn't exist
    if (!overlay) {
      const newOverlay = document.createElement('div');
      newOverlay.className = 'sidebar-overlay';
      document.body.appendChild(newOverlay);
      
      // Close sidebar when clicking overlay
      newOverlay.addEventListener('click', closeSidebar);
    }
    
    // Toggle sidebar
    sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Close sidebar with Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeSidebar();
      }
    });
    
    // Auto-close sidebar when sidebar items are clicked
    const sidebarLinks = sidebar.querySelectorAll('a, button');
    sidebarLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        // Don't close if it's a submenu toggle or has preventDefault
        if (!e.target.classList.contains('submenu-toggle') && 
            !e.target.closest('.submenu-toggle')) {
          // Small delay to allow the click to register
          setTimeout(closeSidebar, 100);
        }
      });
    });
    
    // Close sidebar when clicking outside
    document.addEventListener('click', function(e) {
      if (sidebar.classList.contains('open') && 
          !sidebar.contains(e.target) && 
          !sidebarToggle.contains(e.target)) {
        closeSidebar();
      }
    });
  }
  
  function toggleSidebar() {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }
  
  function openSidebar() {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // Focus first focusable element in sidebar
    const firstFocusable = sidebar.querySelector('a, button, input, select, textarea');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }
  
  function closeSidebar() {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    
    // Return focus to toggle button
    sidebarToggle.focus();
  }
  
  // Expose functions globally for manual control
  window.mobileSidebar = {
    open: openSidebar,
    close: closeSidebar,
    toggle: toggleSidebar
  };
});

// Add smooth scroll behavior for sidebar content
document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.querySelector('.admin-sidebar');
  if (sidebar) {
    sidebar.style.scrollBehavior = 'smooth';
  }
});

