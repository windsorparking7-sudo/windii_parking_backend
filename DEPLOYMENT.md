# Deploy to Render.com

## 🚀 Quick Deployment Steps:

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/windii-backend.git
git push -u origin main
```

### 2. Deploy on Render
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Render will automatically detect `render.yaml`
6. Click "Create Web Service"

### 3. Your API will be live at:
- `https://windii-backend.onrender.com/api/health`
- `https://windii-backend.onrender.com/api/*`

## 🔧 Database Connection:
Your app will connect to your existing cPanel database at `82.197.65.106`

## 📱 Frontend Integration:
Update your frontend API URLs to:
```
https://windii-backend.onrender.com/api
```

## 🎯 Benefits:
- ✅ Free hosting
- ✅ Automatic HTTPS
- ✅ Auto-deployment from Git
- ✅ Connects to your existing database
- ✅ No server management needed
