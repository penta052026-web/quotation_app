#!/bin/bash

# Quotation App Startup Script
echo "🚀 Starting Quotation Generator Application..."
echo "=========================================="

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    else
        return 0
    fi
}

# Check if ports are available
echo "🔍 Checking ports..."
if ! check_port 3000; then
    echo "❌ Backend port 3000 is busy. Please stop any existing backend servers."
    exit 1
fi

if ! check_port 4200; then
    echo "❌ Frontend port 4200 is busy. Please stop any existing Angular dev servers."
    exit 1
fi

echo "✅ Ports are available"
echo ""

# Start backend in background
echo "🔧 Starting backend server (Port 3000)..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Backend server started successfully (PID: $BACKEND_PID)"
else
    echo "❌ Failed to start backend server"
    exit 1
fi

# Start frontend
echo "🎨 Starting Angular frontend (Port 4200)..."
cd frontend/quotation-frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "🌐 Launching Angular development server..."
echo ""
echo "📋 Application URLs:"
echo "   Frontend: http://localhost:4200"
echo "   Backend:  http://localhost:3000"
echo ""
echo "💡 Use Ctrl+C to stop both servers"
echo "=========================================="

# Start Angular dev server (this will run in foreground)
ng serve --open

# If we get here, Angular dev server was stopped
echo ""
echo "🛑 Stopping backend server..."
kill $BACKEND_PID 2>/dev/null
echo "✅ Application stopped successfully"
