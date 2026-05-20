const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const boardsRoutes = require('./routes/boards.routes');
const columnsRoutes = require('./routes/columns.routes');
const tasksRoutes = require('./routes/tasks.routes');
const subtasksRoutes = require('./routes/subtasks.routes');
const usersRoutes = require('./routes/users.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.send('Task Manager API is running smoothly!');
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/columns', columnsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/subtasks', subtasksRoutes);
app.use('/api/users', usersRoutes);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
