import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import { AuthContext } from "../contexts/AuthContext";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(AuthContext);

  const handleJoinVideoCall = async () => {
    const code = meetingCode.trim();

    if (!code) {
      alert("Please enter a meeting code");
      return;
    }

    await addToUserHistory(code);
    navigate(`/${code}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleJoinVideoCall();
    }
  };

  return (
    <>
      <div className="navBar">
        <div className="navLeft">
          <h2 className="brandTitle">Apna Video Call</h2>
        </div>

        <div className="navRight">
          <div
            className="historyBtn"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/history")}
            onKeyDown={(e) => e.key === "Enter" && navigate("/history")}
          >
            <IconButton className="historyIcon">
              <RestoreIcon />
            </IconButton>
            <p className="navText">History</p>
          </div>

          <Button
            className="logoutBtn"
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/");
            }}
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="meetContainer">
        <div className="leftPanel">
          <div className="leftPanelContent">
            <h2 className="heroTitle">
              Providing Quality Video Call Just Like Quality Education
            </h2>

            <div className="joinRow">
              <TextField
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                onKeyDown={handleKeyDown}
                label="Meeting Code"
                variant="outlined"
                className="meetingInput"
              />
              <Button
                onClick={handleJoinVideoCall}
                variant="contained"
                className="joinBtn"
              >
                Join
              </Button>
            </div>
          </div>
        </div>

        <div className="rightPanel">
          <img src="/grouplogo.jpg" alt="Video Call" />
        </div>
      </div>
    </>
  );
}

export default withAuth(HomeComponent);
