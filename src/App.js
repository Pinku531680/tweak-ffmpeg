import React, {useState, useEffect} from "react"
import './App.css';
import Options from "./options";
import ChangeResolution from "./changeResolution";
import ExtractAudio from "./extractAudio";
import ExtractVideo from "./extractVideo"
import ExtractFrame from "./extractFrame"
import ConvertToGIF from "./convertToGIF"
import ExtractGIF from "./extractGIF";
import Output from "./output";
import icon99 from "./icon99.png"
import TrimVideo from "./trimVideo";
import MergeVideos from "./mergeVideos";
import ChangeFrameRate from "./changeFrameRate";


function App() {

  const BASE_URL = "http://localhost:5000"
  const ONE_MB = 1048576


  const [selectedOption, setSelectedOption] = useState("Options")
  const [targetFile, setTargetFile] = useState({
    fileName: null, fileURL: null, fileSize: 0
  })


  const handleOptionSelect = (option) => {
    setSelectedOption(option)
    console.log(option)
  }

  const handleSetFileData = (name, url, size) => {
    setTargetFile((prevState) => {
      prevState.fileName = name
      prevState.fileURL = url
      prevState.fileSize = size
      return prevState
    })
  }

  function formatTime(timeInSecs) {

    let hrs = parseInt(timeInSecs/3600)
    let mins = parseInt((timeInSecs - (hrs*3600))/60)
    let secs = parseInt((timeInSecs - (hrs*3600) - (mins*60)))
 
    return `${hrs}:${mins}:${secs}`;

  }

  function fillZero(time) {
    
    if(time.length === 0) {
        return `00`
    }
    else if(time.length === 1) {
        return `0${time}`
    }
    else {
        return time
    }
}

function fillZeroes(timeString) {
    // Check if time is in HH:MM:SS format
    let parts = timeString.split(":")
    let hrs, mins, secs
    
    if(parts.length === 3) {
        hrs = fillZero(parts[0])
        mins = fillZero(parts[1])
        secs = fillZero(parts[2])
        
    }
    else if(parts.length === 2) {
        hrs = fillZero("")
        mins = fillZero(parts[0])
        secs = fillZero(parts[1])
    
    }
    else if(parts.length === 1) {
        hrs = fillZero("")
        mins = fillZero("")
        secs = fillZero(parts[0])
    }
    else {
        return -1
    }

    
    if(parseInt(hrs) > 60 || 
        parseInt(mins) > 60 || 
        parseInt(secs) > 60) {
        return -1
    }
    
    return `${hrs}:${mins}:${secs}`
}


function exceedsDuration(test, duration) {
    // Function to check whether test time string exceeds duration
    let testParts = test.split(":")
    let durationParts = duration.split(":")
    
    let testHrs = parseInt(testParts[0])
    let testMins = parseInt(testParts[1])
    let testSecs = parseInt(testParts[2])
    let durationHrs = parseInt(durationParts[0])
    let durationMins = parseInt(durationParts[1])
    let durationSecs = parseInt(durationParts[2])
    
    if(testHrs > durationHrs) {
        // If HRS(test) > HRS(duration) -> Exceeds = true
        return true;
    }
    
    if(testHrs === durationHrs) {
        // If HRS(test) === HRS(duration) -> Check further
        if(testMins > durationMins) {
            return true;
        }
        
        if(testMins < durationMins) {
            // If this is the case -> We don't need to check 'secs'
            // Test string is valid -> Exceeds = false
            return false;
        }
        
        if(testMins === durationMins) {
            // If this is the case -> check 'secs'
            if(testSecs >= durationSecs) {
                return true;
            }
        }
    }
   
    if(testHrs < durationHrs) {
        // If HRS(test) < HRS(duration) -> Exceeds = false
        return false;
    }
    
}

function validateTime(startTime, endTime, duration) {
    // Check whether startTime or endTime exceeds duration
    // Check whether startTime exceeds endTime
    startTime = fillZeroes(startTime)
    endTime = fillZeroes(endTime)
    duration = fillZeroes(duration)
    
    if(startTime === -1 || endTime === -1) {
        //console.log("startTime or endTime invalid")
        return "Start time or end time is invalid"
    }
    
    if(exceedsDuration(startTime, endTime)) {
        //console.log("Start time exeeds end time")
        return "Start time exceeds end time"
    }
    else if(exceedsDuration(startTime, duration)) {
        //console.log("Start time exceeds duration")
        return "Start time exceeds video duration"
    }
    else if(exceedsDuration(endTime, duration)) {
        //console.log("End time exceeds duration")
        return "End time exceeds video duration"
    }
    else {
        //console.log("All strings are valid")
        return "OK"
    }
    
}


  return (
    <div className="container">
        <div className="header">
            <img height="34" width="34" src={icon99} />
            <span>tweak</span>
        </div>
          {selectedOption === "Options" && <Options handleOptionSelect={handleOptionSelect} />}
          {selectedOption === "Change Resolution" && <ChangeResolution handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData}/>}
          {selectedOption === "Extract Audio" && <ExtractAudio handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData}
            fillZeroes={fillZeroes} 
            formatTime={formatTime}
            validateTime={validateTime} />}
          {selectedOption === "Extract Video" && <ExtractVideo handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData}
            fillZeroes={fillZeroes}
            formatTime={formatTime}
            validateTime={validateTime} />} 
          {selectedOption === "Extract Frame" && <ExtractFrame handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData}
            fillZeroes={fillZeroes}
            formatTime={formatTime}
            validateTime={validateTime}
            exceedsDuration={exceedsDuration} />}
          {selectedOption === "Convert to GIF" && <ConvertToGIF handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData} />}
          {selectedOption === "Extract GIF" && <ExtractGIF handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData} 
            fillZeroes={fillZeroes}
            formatTime={formatTime}
            validateTime={validateTime} />}
          {selectedOption === "Trim Video" && <TrimVideo handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData}
            fillZeroes={fillZeroes}
            formatTime={formatTime}
            validateTime={validateTime} />}
          {selectedOption === "Merge Videos" && <MergeVideos handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData} />}
          {selectedOption === "Change Frame Rate" && <ChangeFrameRate handleOptionSelect={handleOptionSelect} handleSetFileData={handleSetFileData} />}
          {selectedOption === "Download" && <Output handleOptionSelect={handleOptionSelect} targetFile={targetFile} />}
    </div>
  );
}

export default App;
