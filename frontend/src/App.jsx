import React from 'react'
import { Route, Routes } from 'react-router-dom'
import LandingPage from './pages/landing'
import Authentication from './pages/authentication';
import HomeComponent from './pages/home'
import History from './pages/history';



import './App.css'
import VideoMeetComponent from './pages/VideoMeet';

function App() {

  return (
    <>
      <Routes>
        <Route path='/' element={<LandingPage />} />
        <Route path='/auth' element={<Authentication />} />
        <Route path='/home' s element={<HomeComponent />} />
        <Route path='/history' element={<History />} />
        <Route path='/:url' element={<VideoMeetComponent />} />
      </Routes>
    </>
  )
}

export default App
