# 🎯 Features Included:
## Authentication:
#### -Login/Register system
#### -User session management

## File Management:

#### -Add files, text notes, and links
#### -Organize items in collections
#### -Tag items for easy categorization
#### -Full-text search across all content
#### -Preview functionality

## User Interface:

#### -Modern, clean design with Tailwind CSS
#### -Responsive layout
#### -Intuitive navigation
#### -Quick filters by collection and tags

## 🚀 Step-by-Step Setup
1. Prerequisites
Install the following on your system:

Node.js (v14 or higher) - Download
MySQL (v8.0 or higher) - Download
npm or yarn (comes with Node.js)

🎯 Running the Application
Development Mode

Terminal 1 - Backend:

bashcd backend
npm run dev

Terminal 2 - Frontend:

bashcd frontend
npm start

Open browser: http://localhost:3000


📝 API Endpoints
Authentication

POST /api/auth/register - Register new user
POST /api/auth/login - Login user

Collections

GET /api/collections - Get all collections
POST /api/collections - Create collection

Tags

GET /api/tags - Get all tags
POST /api/tags - Create tag

Items

GET /api/items?search=&collection=&tags= - Get items with filters
POST /api/items - Create text/link item
POST /api/items/upload - Upload file
DELETE /api/items/:id - Delete item
GET /api/items/:id/download - Download file


🔒 Security Notes

Change JWT Secret in .env to a strong random string
Never commit .env file to version control
Add .env to .gitignore
In production, use HTTPS
Set proper CORS origins instead of allowing all
