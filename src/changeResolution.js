import React, {useState, useEffect, useRef} from 'react'
import "./App.css"


function ChangeResolution({handleOptionSelect, handleSetFileData}) {

  const validTypes = ["mp4", "mkv"]
  const ONE_MB = 1048576
  const BASE_URL = "https://tweak-ffmpeg.onrender.com"
  let progressPerUnitChunk = null

  let modifiedFileName = "";

  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)
  const [fileDisplayName, setFileDisplayName] = useState(null)
  const videoRef = useRef()
  const [videoDimensions, setVideoDimensions] = useState({
    width: null, height: null
  })
  const [newVideoDimensions, setNewVideoDimensions] = useState({
    width: null, height: null
  })
  const [ready, setReady] = useState(false)
  const [videoExtension, setVideoExtension] = useState(null)

  const [progress, setProgress] = useState(false)
  const [progressProps, setProgressProps] = useState({
    percent: 0, name: null
  })

  let progressRef = useRef(null)
  

  // FINDING DIMENSIONS OF SELECTED VIDEO FILE
  const findVideoStats = (file) => {

    let objURL = URL.createObjectURL(file)

    videoRef.current.src = objURL

    videoRef.current.onloadedmetadata = () => {
      // Set video width and height
      setVideoDimensions({...videoDimensions, 
        height: videoRef.current.videoHeight,
        width: videoRef.current.videoWidth
      })

      setReady(true)

      URL.revokeObjectURL(objURL)

    }

  }


  // FILE VALIDATION ON FILE CHANGEE
  const handleFileChange = (e) => {
    let file = e.target.files[0]
    let fileExtension = file.name.slice(file.name.lastIndexOf(".")+1, )
    let fileSizeInMB = Math.ceil(file.size / ONE_MB)

    // File Size Limit -> 500 MB
    if(validTypes.includes(fileExtension)) {

      if(fileSizeInMB < 500) {
        // File is valid
        setSelectedFile(file)
        setVideoExtension(fileExtension)
        if(file.name.length > 25) {
          let x = `${file.name.slice(0,15)}...${file.name.slice(-10, )}`
          setFileDisplayName(x)
        }
        else {
          setFileDisplayName(file.name)
        }
        
        findVideoStats(file)

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


  // AFTER VIDEO UPLOAD, CALL THIS FUNCTION
  const changeResolution = () => {

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
      console.log("ON MESSAGE")
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

    console.log("MODIFIED NAME: ", modifiedFileName);

    fetch(
      `${BASE_URL}/api/change-resolution`,
      {
        method: "POST",
        body: JSON.stringify({
          //fileName: selectedFile.name,
          fileName: modifiedFileName,
          newWidth: newVideoDimensions.width,
          newHeight: newVideoDimensions.height
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

      if(data.message === "PROCESSING FAILED") {
        console.log("PROCESSING FAILED DUE TO SOME ERROR");
        setProgress(false);
        return;
      }
      
      setProgressProps((prevState) => {
        prevState.percent = 100
        return prevState
      })

      progressRef.current.style.width = "100%"

      if(data.message === "PROCESSING SUCCESS") {
        handleSetFileData(data.fileName, data.fileURL, data.fileSize)
        
        setTimeout(() => {
          handleOptionSelect("Download")
        }, 1000)
        
      }
      else {
        console.log("PROCESSING ERROR!")
      }

    })
    .catch((err) => {
      console.log(err)
    })

  }


  // CALL THIS FUNCTION FOR EACH CHUNK
  const uploadChunk = (index, isLastChunk) => {

    let chunk = selectedFile.slice(index*(ONE_MB*15), (index+1)*(ONE_MB*15))

    const fileReader = new FileReader()

    fileReader.onload = (e) => {
      
    }
    fileReader.onloadend = (e) => {
      let result = e.target.result
      let byteLength = e.target.result.byteLength
      
      fetch(
        `${BASE_URL}/api/upload`,
        {
          body: result,
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "file-name": modifiedFileName,
            "is-last-chunk": isLastChunk,
            "file-extension": videoExtension,
            "new-width": newVideoDimensions.width,
            "new-height": newVideoDimensions.height
          },
        }
      ).then((res) => {

        return res.json()
        
      }).then((data) => {
        console.log(data)
        let progressState = data.message === "LAST CHUNK" ? 'done' : 'progress'

        let newProgressPercentage = Math.ceil(progressPerUnitChunk*(index+1))
        
        console.log("NEW PROGRESS PERCENTAGE: ", newProgressPercentage)

        setProgressProps((prevState) => {
          prevState.percent = newProgressPercentage
          return prevState
        })

        // Increase the width of progress div
        if(newProgressPercentage > 100) {
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

            // SEND DATA TO CHANGE RESOLUTION ROUTE AFTER FILE HAS BEEN UPLOADED
            changeResolution()
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


  // START UPLOAD AND CALL handleUpload()
  const startUpload = (index) => {
    setError(null)

    // We add a random 4 digit number before the fileName to prevent errors
    // due to existing filenames
    // We have to choose a random number only once, so we do that in this function 
    // and not in upload functions
    const randomNumber = Math.round(Math.random() * 10000).toString();
    modifiedFileName = randomNumber + "-" + selectedFile.name; 

    if(newVideoDimensions.height === null || newVideoDimensions.width === null) {
      setError("Please specify new dimensions")
      return
    }

    if(newVideoDimensions.height > videoDimensions.height ||
      newVideoDimensions.width > videoDimensions.width) {
        setError("New dimensions must not exceed current dimensions")
        return
    }

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


  const handleTest = () => {
    console.log("Cliked!")

    const source = new EventSource("http://localhost:5000/test")

    source.onopen = (e) => {
      console.log("Opened!")
    }
    source.onmessage = (e) => {
      console.log("on message")
      console.log(e)
    }
    source.onerror = (e) => {
      console.log("Some Error!")
    }
   
  }

  return (
    <div>
        <div className='change-resolution-title'>
            <div className='back-btn' onClick={() => handleOptionSelect("Options")}>
              <i className='fa-solid fa-angle-left'></i>
            </div>
            <div>
              <span>Change Resolution</span>
            </div>
        </div>
        <div className='change-resolution-body'>
            <div className='file-input-div'>
                <p>Select a Video File</p>
                <input type='file'id='file-input' multiple={false} 
                onChange={(e) => handleFileChange(e)}
                disabled={progress}
                />
                <label htmlFor='file-input'>
                Choose File
                </label>
                <span>{selectedFile === null ? "No file selected" : 
                fileDisplayName}
                </span>
            </div>
            <div className='current-dimensions'>
                <p>Current Dimensions</p>
                <div>
                  <input type='number' placeholder='W' 
                  value={videoDimensions.width ? videoDimensions.width : ""}
                  readOnly/>
                  <span>x</span>
                  <input type='number' placeholder='H'
                  value={videoDimensions.height ? videoDimensions.height : ""} 
                  readOnly/>
                </div>
            </div>
            <div className='new-dimensions'>
                <p>New Dimensions</p>
                <div>
                  <input type='number' placeholder='W' disabled={progress}
                  onChange={(e) => setNewVideoDimensions({...newVideoDimensions, width: e.target.value})}
                  value={newVideoDimensions.width ? newVideoDimensions.width:""}
                  />
                  <span>x</span>
                  <input type='number' placeholder='H' disabled={progress}
                  onChange={(e) => setNewVideoDimensions({...newVideoDimensions, height: e.target.value})}
                  value={newVideoDimensions.height ? newVideoDimensions.height:""}
                  />
                </div>
            </div>
            <div className='upload-section'>
            {progress === false ? 
                <button onClick={() => startUpload(0)} disabled={!ready}>
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
            <div className='error-section'>
              {error && <p>Error: {error}</p>}
            </div>
            <video ref={videoRef}></video>
        </div>
    </div>
  )
}

export default ChangeResolution