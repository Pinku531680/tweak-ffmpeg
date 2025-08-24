import React, {useState, useRef} from 'react'
import "./App.css"


function ExtractAudio({handleOptionSelect, handleSetFileData, formatTime, 
  fillZeroes, validateTime}) {

  const ONE_MB = 1048576
  const BASE_URL = "http://localhost:5000"
  let progressPerUnitChunk = null
  const validTypes = ["mp4", "mkv"]
  const validBitrates = [64, 128, 192, 256, 320]
  let modifiedFileName = "";

  const videoRef = useRef(null)
  const checkBoxRef = useRef(null)
  const [checked, setChecked] = useState(false)
  const [progress, setProgress] = useState(false)
  const [ready, setReady] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)
  const [fileDisplayName, setFileDisplayName] = useState(null)
  const [range, setRange] = useState({
    from: null, to: null
  })
  const [audioBitrate, setAudioBitrate] = useState(null)

  const progressRef = useRef(null)
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

      console.log("FILE TYPE IS VALID");
      console.log(file);

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

  const extractAudio = () => {

    setProgress(true)
    setProgressProps((prevState) => {
      prevState.name = "Processing file"
      prevState.percent = 0
      return prevState
    })

    // SET PROGRESS TO 0%
    progressRef.current.style.width = "0%"

    // ONCE FILE HAS BEEN UPLOADED, WE WILL OPEN AN EVENT SOURCE FOR REAL-TIME PROGRESS UPDATES
    const source = new EventSource("http://localhost:5000/api/progress")

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


    fetch(
      `${BASE_URL}/api/extract-audio`,
      {
        method: "POST",
        body: JSON.stringify({
          fileName: modifiedFileName,
          startDuration: !checked ? fillZeroes(range.from) : 0,
          endDuration: !checked ? fillZeroes(range.to) : 0,
          audioBitrate: audioBitrate,
          extractEntireAudio: checked ? true : false
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
      
      console.log("MODIFIED FILE NAME: ", modifiedFileName);

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

            // SEND DATA TO extract-audio ROUTE AFTER FILE HAS BEEN UPLOADED
            // CALL EXTRACTAUDIO() FUNCTION
            extractAudio()
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


  const findVideoDuration = (file) => {
    let objURL = URL.createObjectURL(file)

    videoRef.current.src = objURL

    videoRef.current.onloadedmetadata = () => {
      let durationInSecs = Math.ceil(videoRef.current.duration)
      // USE formatTime() DEFINED IN App.js 
      let duration = formatTime(durationInSecs)

      setVideoDuration(duration)
      console.log("ON LOADED METADATA")
      
      // After having the duration, we free the memory allocated to this video
      URL.revokeObjectURL(objURL)

      // First check whether all inputs are valid
      let inputsValid = validation(duration)

      if(inputsValid === true) {
        let canContinue = validateRange(duration)

        if(canContinue) {
          // If range inputs are valid, start uploading the file
          startUpload(0)
        }
        else {
          console.log("RANGE VALIDATION FAILED")
        }
      }
      else {
        console.log("INPUTS VALIDATION FAILED")
      }
      
      /*
      if(canContinue) {
        // IF VALIDATION SUCCESS, CALL startUpload() with index = 0
        startUpload(0)
      }
      else {
        console.log("VALIDATION FAILED!")
      }
      */

    }
  }

  const validateRange = (duration) => {
    // HH:MM:SS

    if(checked) {
      return true;
    }
    
    // Check whether range.from and range.to is same
    let from = fillZeroes(range.from)
    let to = fillZeroes(range.to)
    let videoDuration = fillZeroes(duration)

    console.log("FROM: ",  from)
    console.log("TO: ", to)
    console.log("DURATION: ", videoDuration)

    // fillZeroes() returns -1 if time format is invalid
    if(from === -1 || to === -1) {
      setError("From or To is invalid")
      return false;
    }

    // Pass from, to, duration and setError to validateTime() function

    let output = validateTime(from, to, videoDuration)

    if(output !== "OK") {
      setError(output)
      return false;
    }

    return true;
  }


  const validation = (duration) => {
    console.log("INSIDE VALIDATION")

    if(!checked && (range.from === null || range.to === null)) {
      setError("Please specify range")
      return false
    }

    if(audioBitrate === null) {
      setError("Please specify an audio bitrate")
      return false
    }

    if(validBitrates.includes(parseInt(audioBitrate)) === false) {
      setError("Please select valid audio bitrate")
      return false
    }

    // RETURN true IF NO CONDITIONS MATCHED
    return true

  }

  const handleUploadButtonClick = () => {

    findVideoDuration(selectedFile)

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
    
    console.log("INSIDE START UPLOAD");
    console.log("MODIFIED FILE NAME:", modifiedFileName);

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


  return (
    <div>
        <div className='extract-audio-title'>
            <div className='back-btn' onClick={() => handleOptionSelect("Options")}>
              <i className='fa-solid fa-angle-left'></i>
            </div>
            <div>
              <span>Extract Audio</span>
            </div>
        </div>
        <div className='extract-audio-body'>
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
            <div className='range'>
              <div className='range-title'>
                <p>Range</p>
              </div>
              <div>
                Time format - HH:MM:SS
              </div>
              <div className='range-select'>
                <input placeholder='From' disabled={checked}
                value={range.from === null ? "" : range.from}
                onChange={(e) => {
                  let temp = {...range}
                  temp.from = e.target.value
                  setRange(temp)
                }}  
                />
                <input placeholder='To' disabled={checked}
                value={range.to === null ? "" : range.to}
                onChange={(e) => {
                  let temp = {...range}
                  temp.to = e.target.value
                  setRange(temp)
                }}
                />
              </div>
              <div className='or'>
                  OR
              </div>
              <div className='range-checkbox' onClick={() => {
                checkBoxRef.current.checked = !(checkBoxRef.current.checked)
                setChecked(prevState => !prevState)
              }}>
                  <input type='checkbox' ref={checkBoxRef} />
                  <span className='checkmark'></span>
                  <p>Extract entire audio</p>
              </div>
            </div>
            <div className='bitrate'>
              <p>Audio Bitrate</p>
              <div className='bitrate-select'>
                <span>Range - 64, 128, 192, 256, 320 (kbps)</span>
                <input placeholder='Bitrate' 
                value={audioBitrate === null ? "" : audioBitrate}
                onChange={(e) => {
                  setAudioBitrate(e.target.value)
                }}
                />
              </div>
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
            <div className='error-section'>
              {error && <p>Error: {error}</p>}
            </div>
            <video ref={videoRef}></video>
        </div>
    </div>
  )
}

export default ExtractAudio