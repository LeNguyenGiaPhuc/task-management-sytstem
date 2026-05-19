# Task Management - Jira/Kanban Clone

A task management application based on the Kanban model, inspired by Jira/Trello. The project is built with a separated frontend and backend architecture, uses a PostgreSQL database, provides REST APIs, supports workspace/board management, task drag and drop, checklists, and includes sample data for demonstration.

## Project Goals

This project was developed to simulate a real-world task management system at a mini-product level:

- Manage multiple workspaces/boards.
- Manage columns based on work status.
- Manage tasks with priority, due date, description, and checklist.
- Drag and drop tasks between columns and persist their order in the database.
- Design a database foundation for RBAC, activity logs, and attachments.
- Provide a clean and professional web interface suitable for a work management dashboard.

## Demo Features

### Workspace / Home

- View the list of boards.
- Create a new board.
- Edit board name and description.
- Delete a board.
- Duplicate a board, including columns, tasks, and checklists.
- Search boards by name or description.
- Sort boards by:
  - newest first,
  - recently updated,
  - A-Z,
  - Z-A.
- Display statistics for the number of boards, columns, and tasks.

### Board Detail

- Navigate back to the Workspaces page.
- View the list of columns in a board.
- Create a new column.
- Rename a column.
- Delete a column.
- Create tasks inside each column.
- Drag and drop tasks between columns.
- Persist task positions using the `order` field in the database.
- Search tasks.
- Filter tasks by priority.
- Disable drag and drop while filtering/searching to avoid incorrect ordering.

### Task Detail

- Click a task to open its detail modal.
- Edit:
  - title,
  - description,
  - priority,
  - due date.
- Delete a task.
- Duplicate a task.
- Add checklist/subtasks.
- Mark checklist items as completed.
- Delete checklist items.
- Show checklist progress on the task card.

### Database-Ready Features

The database is already prepared for future expansion:

- User management.
- Board members.
- RBAC with `OWNER`, `ADMIN`, and `MEMBER` roles.
- Activity logs.
- Task attachments.
- Task assignees.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- App Router
- `@hello-pangea/dnd` for Kanban drag and drop

### Backend

- Node.js
- Express.js
- Prisma ORM v7
- PostgreSQL
- `pg`
- `@prisma/adapter-pg`
- `dotenv`
- `cors`

### Database

- PostgreSQL
- UUID primary keys
- Enums for priority and board role
- Indexes for important queries
- Trigger to automatically update `updated_at`

## Folder Structure

```txt
Task-Manager/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── server.js
│   ├── seed.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── app/
│   │   ├── boards/
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── create-board-button.tsx
│   │   ├── home-workspaces.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── package.json
│   └── postcss.config.mjs
│
└── README.md
```

## Database Design

Main tables:

| Table | Purpose |
| --- | --- |
| `users` | Stores user information |
| `boards` | Stores workspaces/boards |
| `board_members` | Many-to-many relationship between users and boards, with roles |
| `columns` | Status columns inside a board |
| `tasks` | Task cards |
| `sub_tasks` | Task checklists/subtasks |
| `task_attachments` | Files/links attached to tasks |
| `activity_logs` | Activity history inside a board |

Enums:

```sql
task_priority = LOW | MEDIUM | HIGH | URGENT
board_role = OWNER | ADMIN | MEMBER
```

## Environment Requirements

Required tools:

- Node.js
- npm
- PostgreSQL
- Git

Recommended versions:

- Node.js 20+
- PostgreSQL 15+

## Project Setup

Clone the repository:

```bash
git clone <your-repository-url>
cd Task-Manager
```

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

## Environment Configuration

Create a `.env` file inside the `backend` folder:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
PORT=5000
```

Local example:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/task_manager"
PORT=5000
```

If PostgreSQL uses `gen_random_uuid()` for UUID generation, enable this extension:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Running the Project

### 1. Run the Backend

Inside the `backend` folder:

```bash
node server.js
```

The backend runs at:

```txt
http://localhost:5000
```

### 2. Run the Frontend

Inside the `frontend` folder:

```bash
npm run dev
```

The frontend runs at:

```txt
http://localhost:3000
```

## Seed Sample Data

The project includes a script for quickly creating demo data:

```bash
cd backend
npm run seed
```

The seed script creates:

- Demo users.
- `Jira Clone Roadmap` board.
- `Product Launch Plan` board.
- Sample columns.
- Tasks with multiple priorities and due dates.
- Checklists/subtasks.
- Sample attachment.
- Sample activity logs.

The script is designed to be idempotent, so it can be run multiple times without creating large amounts of duplicate core data.

## Main APIs

### Boards

```txt
GET    /api/boards
POST   /api/boards
GET    /api/boards/:id
PUT    /api/boards/:id
DELETE /api/boards/:id
POST   /api/boards/:id/duplicate
```

### Columns

```txt
POST   /api/columns
PUT    /api/columns/:id
DELETE /api/columns/:id
```

### Tasks

```txt
GET    /api/tasks
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
```

### Subtasks

```txt
POST   /api/subtasks
PUT    /api/subtasks/:id
DELETE /api/subtasks/:id
```

## Build and Validation

Frontend lint:

```bash
cd frontend
npm run lint
```

Frontend production build:

```bash
npm run build
```

Backend syntax check:

```bash
cd backend
node --check server.js
node --check seed.js
```

## Technical Highlights

- Clear separation between frontend and backend.
- REST API built with Express.
- Prisma ORM connected to PostgreSQL.
- Kanban drag and drop with persistent ordering.
- Uses a floating-point `order` field to optimize drag-and-drop reordering.
- Database indexes for board/column/task ordering.
- Schema foundation for RBAC.
- Neutral dashboard-style UI suitable for work management applications.
- Seed data for quick project demonstration.

## Author

This project was built for learning, practicing full-stack development, and simulating the process of building a real-world task management application.
