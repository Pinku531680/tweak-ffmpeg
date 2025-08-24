import React, {useState, useRef, useEffect} from 'react'
import "./App.css"


function ExtractFrame({handleOptionSelect, handleSetFileData, fillZeroes, formatTime, 
  exceedsDuration
}) {

  const ONE_MB = 1048576
  const BASE_URL = "https://tweak-ffmpeg.onrender.com"
  let progressPerUnitChunk = null
  const validTypes = ["mp4", "mkv"]
  let modifiedFileName = "";

  const [progress, setProgress] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileDisplayName, setFileDisplayName] = useState(null)

  const [ready, setReady] = useState(false)
  const videoRef = useRef(null)
  const progressRef = useRef(null)
  const [time, setTime] = useState("");
  const [error, setError] = useState(null)
  
  const [progressProps, setProgressProps] = useState({
    name: null, percent: 0
  })

  const [videoDuration, setVideoDuration] = useState(null)


  // CALL THIS FUNCTION ON FILE CHANGE
  const handleFileChange = (e) => {
    let file = e.target.files[0]
    let fileExtension = file.name.slice(file.name.lastIndexOf(".") + 1, )
    let fileSizeInMB = Math.ceil(file.size / ONE_MB)

    // File Size Limit -> 500 MB
    if(validTypes.includes(fileExtension)) {

      if(fileSizeInMB < 500) {
        // File is valid
        setSelectedFile(file)
        setReady(true)
        if(file.name.length > 25) {
          let x = `${file.name.slice(0,15)}...${file.name.slice(-10, )}`
          setFileDisplayName(x)
        }
        else {
          setFileDisplayName(file.name)
        }

      }
      else {
        setError("File size must be less than 500 MB")
        return
      }

    }
    else {
      setError("File extension must be .mp4 or .mkv")
      return
    }
  }

  // Request to process the uploaded video and return metadata
  const extractFrame = () => {

    console.log("INSIDE EXTRACT VIDEO")

    setProgress(true)
    setProgressProps((prevState) => {
      prevState.name = "Processing file"
      prevState.percent = 0
      return prevState
    })

    // SET PROGRESS TO 0%
    progressRef.current.style.width = "0%"

    // ONCE FILE HAS BEEN UPLOADED, WE WILL OPEN AN EVENT SOURCE FOR REAL-TIME PROGRESS UPDATES
    const source = new EventSource(`${BASE_URL}/api/progress`)

    source.onopen = (e) => {
      console.log("SSE OPENED")
    }
    source.onmessage = (e) => {
      
      let x = parseInt(e.data)
      console.log("DATA: ", x)

      // SET PROGRESS % ACCORDING TO PROCESSING DONE
      progressRef.current.style.width = `${x}%`

      if(x === 100) {
        // ONCE PROGRESS = 100, CLOSE THE CONNECTION
        source.close()
      }
      
    }
    source.onerror = (e) => {
      console.log("SSE CLOSED")
      source.close()
    }


    fetch(
      `${BASE_URL}/api/extract-frame`,
      {
        method: "POST",
        body: JSON.stringify({
          fileName: modifiedFileName,
          time: fillZeroes(time)
        }),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    ).then((res) => {
      return res.json()
    })
    .then((data) => {
      console.log(data)
      
      setProgressProps((prevState) => {
        prevState.percent = 100
        return prevState
      })

      progressRef.current.style.width = "100%"

      if(data.message === "PROCESSING SUCCESS") {

        progressRef.current.style.width = "100%"
        console.log("PROCESSING SUCCESS")
        source.close()
        
        handleSetFileData(data.fileName, data.fileURL, data.fileSize)
        
        setTimeout(() => {
          handleOptionSelect("Download")
        }, 1000)
        
      }
      else {
        console.log("PROCESSING ERROR!");
        setProgress(false);
        source.close();
        return;
      }

    })
    .catch((err) => {
      console.log(err)
    })


  }


  // CALL THIS FUNCTION FOR EACH CHUNK
  const uploadChunk = (index, isLastChunk) => {

    // Params - ONE_MB, selectedFile, BASE_URL, progressPerUnitChunk, setProgressProps, progressRef, setProgress
    // Last - extractionFunction() -> Different for all 

    let chunk = selectedFile.slice(index*(ONE_MB*15), (index+1)*(ONE_MB*15))

    const fileReader = new FileReader()

    fileReader.onload = (e) => {
      console.log("File Reader started");
    }
    fileReader.onloadend = (e) => {
      let result = e.target.result
      let byteLength = e.target.result.byteLength;
      
      fetch(
        `${BASE_URL}/api/upload`,
        {
          body: result,
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "file-name": modifiedFileName,
            "is-last-chunk": isLastChunk,
          },
        }
      ).then((res) => {

        return res.json()
        
      }).then((data) => {
        console.log(data)
        let progressState = data.message === "LAST CHUNK" ? 'done' : 'progress'

        let newProgressPercentage = Math.ceil(progressPerUnitChunk*(index+1))
        

        setProgressProps((prevState) => {
          prevState.percent = newProgressPercentage
          return prevState
        })

        // Increase the width of progress div
        if(newProgressPercentage >= 100) {
          progressRef.current.style.width = "100%"
        }
        else {
          progressRef.current.style.width = `${newProgressPercentage}%`
        }

        
        // Check and state of progress
        if(progressState === 'progress') {
          // Once current chunk is uploaded, call the handleUpload() at ->  index = (index+1)
          setTimeout(() => {
            handleUpload(index+1)
          }, 500)
          
        }
        else if (progressState === 'done') {
          // Once all chunks uploaded, set progress to 'false' and return
          setTimeout(() => {
            setProgress(false)
            setProgressProps({...progressProps, name: null, percent: 0})

            // SEND DATA TO extract-frame ROUTE AFTER FILE HAS BEEN UPLOADED
            // CALL EXTRACTFRAME() FUNCTION
            extractFrame()
          }, 500)
        }
       
        
      })
      .catch((err) => {
          setError(err.message)
      }) 


    }
    fileReader.onerror = (e) => {
      console.log("Error while reading the file!")
    }

    fileReader.readAsArrayBuffer(chunk)
    
  }

  const handleUpload = (index) => {
    // Params - selectedFile.size, ONE_MB, progressPerUnitChunk

    // File Size in Mega Bytes
    let fileSize = Math.round(selectedFile.size / ONE_MB)
    //console.log("File Size(MB): ", fileSize)

    // Decide how many 15MB chunks the file has
    let numberOfChunks = Math.ceil(fileSize / 15)
    progressPerUnitChunk = 100/numberOfChunks


    if(index >= numberOfChunks) {
      console.log("All Chunks Uploaded!")
      return
    }
    
    if(index === numberOfChunks - 1) {
      uploadChunk(index, true)
    }
    else {
      uploadChunk(index, false)
    }
  }

  

  const startUpload = (index) => {

    setError(null)
    // We add a random 4 digit number before the fileName to prevent errors
    // due to existing filenames
    // We have to choose a random number only once, so we do that in this function 
    // and not in upload functions
    const randomNumber = Math.round(Math.random() * 10000).toString();
    modifiedFileName = randomNumber + "-" + selectedFile.name; 

    setProgressProps((prevState) => {
      prevState.name = "Uploading file"
      prevState.percent = 0
      return prevState
    })
    setProgress(true)

    setTimeout(() => {
      handleUpload(index)
    }, 500)
    
  }

  // On upload button click, fire this function
  const findVideoDuration = (file) => {
    let objURL = URL.createObjectURL(file)

    videoRef.current.src = objURL

    videoRef.current.onloadedmetadata = () => {
      let durationInSecs = Math.ceil(videoRef.current.duration)
      // USE formatTime() DEFINED IN App.js 
      let duration = formatTime(durationInSecs)

      setVideoDuration(duration)
      
      // After we have the duration, we free the memory allocated for object URL
      URL.revokeObjectURL(objURL)

      // First check whether all inputs are valid
      let inputsValid = validation(duration)

      if(inputsValid === true) {
        
        // If inputs are valid, start uploading
        startUpload(0);
      }
      else {
        console.log("INPUTS VALIDATION FAILED")
      }
      

    }
  }

  const validation = (duration) => {

    //Check if time input is empty

    if(time === "") {
      setError("Please specify a time")
      return false;
    }

    const formattedTime = fillZeroes(time);

    if(formattedTime === -1) {
      setError("Invalid time format");
      return false;
    }

    // Check is given time exceeds video duration
    if(exceedsDuration(formattedTime, duration)) {
      setError("Given time exceeds video duration")
      return false;
    }

    return true;

  }

  const handleUploadButtonClick = () => {

    findVideoDuration(selectedFile);

  }

  return (
    <div>
      <div className='extract-frame-title'>
            <div className='back-btn' onClick={() => handleOptionSelect("Options")}>
              <i className='fa-solid fa-angle-left'></i>
            </div>
            <div>
              <span>Extract Frame</span>
            </div>
      </div>
      <div className='extract-frame-body'>
            <div className='file-input-div'>
                <p>Select a Video File</p>
                <input type='file'id='file-input' multiple={false} 
                onChange={(e) => handleFileChange(e)}
                disabled={progress}
                />
                <label htmlFor='file-input'>
                  Choose File
                </label>
                <span>
                  {selectedFile === null ? "No file selected": 
                  fileDisplayName}
                </span>
            </div>
            <div className='time'>
                <div className='time-title'>
                    <p>Select time</p>
                </div>
                <div>
                    Time format - HH:MM:SS
                </div>
                <div className='time-select'>
                    <input placeholder='HH:MM:SS' value={time} 
                    onChange={(e) => setTime(e.target.value)}/>
                </div>
            </div>
            <div className='note-section'>
              <span>*</span>
              <p>Only 1 frame at the given time will be extracted</p>
            </div>
            <div className='upload-section'>
            {progress === false ? 
                <button onClick={() => handleUploadButtonClick()} disabled={!ready}>
                  Upload
                  <i className='fa-solid fa-upload'></i>
                </button>
                :
                <div className='progress-section'>
                  <span>{progressProps.name}</span>
                  <div className='progress-bar'>
                    <div
                    ref={progressRef}
                    ></div>
                  </div>
                </div>
            }
            </div>
            <video ref={videoRef} style={{"display": "none"}}></video>
            <div className='error-section'>
              {error && <p>Error: {error}</p>}
            </div>
        </div>
    </div>
  )
}

export default ExtractFrame