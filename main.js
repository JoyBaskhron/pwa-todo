import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js') // Change this to your service worker file's path
        .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
            console.error('Service Worker registration failed:', error);
        });
}

// Open the IndexedDB
const dbPromise = openDB('toDoList', 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) {
            db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
        }
    },
});

// Function to add a task (handles both adding and editing)
async function addTask(event) {
    event.preventDefault();

    // Get input values
    const title = document.getElementById('task-title').value;
    const details = document.getElementById('task-details').value;
    const date = document.getElementById('task-date').value;
    const time = document.getElementById('task-time').value;
    const notify = document.getElementById('task-notification').checked;

    // Create a task object
    const task = {
        title,
        details,
        dateTime: `${date}T${time}`,
        notified: false,
        notify
    };

    const db = await dbPromise;
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');

    // Check if editing or adding
    const taskIdInput = document.getElementById('edit-task-id');
    if (taskIdInput) {
        // Update existing task
        task.id = parseInt(taskIdInput.value, 10); // Get the task ID from the hidden input
        await store.put(task); // Update the task in the store
    } else {
        // Add new task
        await store.add(task);
    }

    await tx.complete;

    // Clear the form and update the task list
    document.getElementById('task-form').reset();
    updateTaskList();

    // Schedule notification if necessary
    if (notify) {
        scheduleNotification(task);
    }
}

function setupTaskHoverEffects() {
    document.querySelectorAll('.task-item').forEach(task => {
        const bottomSection = task.querySelector('.task-details');
        const taskItem = task;

        // Expand the bottom section
        const expandSection = () => {
            bottomSection.style.transition = 'none'; // Temporarily disable transition
            bottomSection.style.maxHeight = `${bottomSection.scrollHeight}px`; // Set max-height to content height
            requestAnimationFrame(() => {
                bottomSection.style.transition = 'max-height 0.3s ease-out'; // Re-enable transition
            });
        };

        // Collapse the bottom section
        const collapseSection = () => {
            bottomSection.style.maxHeight = '0'; // Set max-height to zero to collapse
        };

        // Event listeners for hover in and hover out
        taskItem.addEventListener('mouseenter', expandSection);
        taskItem.addEventListener('mouseleave', collapseSection);
    });
}


// Function to update the task list
async function updateTaskList() {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';

    const db = await dbPromise;
    const tx = db.transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const tasks = await store.getAll();

    // Sort tasks: starred tasks first, then others
    tasks.sort((a, b) => {
        if (a.starred === b.starred) return 0;
        return a.starred ? -1 : 1;
    });

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';

        // Create the task header
        const taskHeader = document.createElement('div');
        taskHeader.className = 'task-header';

        const taskInfo = document.createElement('div');
        taskInfo.className = 'task-info';

        // Checkbox for completion
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.id = `task-${task.id}`;
        checkbox.checked = task.completed || false;
        taskInfo.appendChild(checkbox);

        // Task title label
        const label = document.createElement('label');
        label.htmlFor = `task-${task.id}`;
        label.textContent = task.title;
        taskInfo.appendChild(label);

        // Task date and time
        const dateSpan = document.createElement('span');
        dateSpan.className = 'task-date';
        dateSpan.textContent = new Date(task.dateTime).toLocaleDateString();
        taskInfo.appendChild(dateSpan);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'task-time';
        timeSpan.textContent = new Date(task.dateTime).toLocaleTimeString();
        taskInfo.appendChild(timeSpan);

        taskHeader.appendChild(taskInfo);

        // Task actions (Star and Delete)
        const taskActions = document.createElement('div');
        taskActions.className = 'task-actions';

        // Star button
        const starButton = document.createElement('button');
        starButton.className = 'action-button star-task';
        // Use filled star if starred, else use outlined star
        starButton.innerHTML = `<img src="assets/${task.starred ? 'tabler_star-filled.svg' : 'tabler_star.svg'}" alt="Star">`;
        starButton.addEventListener('click', () => {
            starTask(task.id);
            // Toggle the icon immediately for a better user experience
            starButton.innerHTML = `<img src="assets/${!task.starred ? 'tabler_star-filled.svg' : 'tabler_star.svg'}" alt="Star">`;
        });
        taskActions.appendChild(starButton);

        // Edit Button
        const editButton = document.createElement('button');
        editButton.className = 'action-button edit-task';
        editButton.innerHTML = '<img src="assets/mynaui_edit-one-solid.svg" alt="Edit">';
        editButton.addEventListener('click', () => openEditForm(task));
        taskActions.appendChild(editButton);

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button';
        deleteButton.innerHTML = '<img src="assets/fluent_delete-20-filled.svg" alt="Delete">';
        deleteButton.addEventListener('click', () => deleteTask(task.id));
        taskActions.appendChild(deleteButton);

        taskHeader.appendChild(taskActions);
        taskItem.appendChild(taskHeader);

        // Event listener for checkbox to toggle completion
        checkbox.addEventListener('change', () => {
            taskItem.classList.toggle('completed', checkbox.checked);
            updateTaskCompletionStatus(task.id, checkbox.checked);
        });

        // Task details
        const taskDetails = document.createElement('div');
        taskDetails.className = 'task-details';
        taskDetails.innerHTML = `<p>${task.details}</p>`;
        taskItem.appendChild(taskDetails);

        taskList.appendChild(taskItem);
        setupTaskHoverEffects()
    });
}


// Function to delete a task
async function deleteTask(id) {
    const db = await dbPromise;
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    await store.delete(id);
    await tx.complete;

    // Update the task list
    updateTaskList();
}

// Function to open edit form with current task data
function openEditForm(task) {
    const taskTitleInput = document.getElementById('task-title');
    const taskDetailsInput = document.getElementById('task-details');

    // Populate the form with current task data
    taskTitleInput.value = task.title;
    taskDetailsInput.value = task.details;

    // Add hidden input for task ID
    let taskIdInput = document.getElementById('edit-task-id');
    if (!taskIdInput) {
        taskIdInput = document.createElement('input');
        taskIdInput.type = 'hidden';
        taskIdInput.id = 'edit-task-id';
        document.getElementById('task-form').appendChild(taskIdInput);
    }
    taskIdInput.value = task.id; // Set the task ID in the hidden input
}

// Function to star a task
async function starTask(id) {
    const db = await dbPromise;
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const task = await store.get(id);

    if (task) {
        task.starred = !task.starred; // Toggle starred status
        await store.put(task); // Save updated task back to IndexedDB
    }
    await tx.complete;

    // Update the task list to reflect changes
    updateTaskList();
}


// Function to schedule notifications
function scheduleNotification(task) {
    const taskTime = new Date(task.dateTime).getTime();
    const currentTime = Date.now();
    const delay = taskTime - currentTime;

    if (delay > 0) {
        setTimeout(() => {
            if (Notification.permission === 'granted') {
                navigator.serviceWorker.getRegistration().then(registration => {
                    registration.showNotification('Task Reminder', {
                        body: `Reminder for: ${task.title}`,
                        tag: task.id
                    });
                });
            }
        }, delay);
    }
}

// Function to set min attributes for date and time inputs
function setMinDateTime() {
    const now = new Date();

    // Format date to YYYY-MM-DD
    const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Format time to HH:MM (24-hour format)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`; // HH:MM

    // Set the min attributes
    document.getElementById('task-date').setAttribute('min', formattedDate);
    document.getElementById('task-time').setAttribute('min', formattedTime);
}

// Event listener for DOMContentLoaded to set min values
document.getElementById('task-form').addEventListener('submit', addTask);
document.addEventListener('DOMContentLoaded', () => {
    setMinDateTime();
    updateTaskList();
    // Notification.requestPermission();
});