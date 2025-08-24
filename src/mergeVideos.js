import React, {useState, useEffect, useRef} from "react";
import "./mergeVideos.css"


function MergeVideos({handleOptionSelect, handleSetFileData}) {

    const ONE_MB = 1048576
    const BASE_URL = "http://localhost:5000"
    let progressPerUnitChunk = null
    const validTypes = ["mp4", "mkv"]
    let modifiedFileNames = [];

    const [progress, setProgress] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState([])
    let currentFileUploadIndex = 0;
    // const [selectedFiles, setSelectedFiles] = useState([
    //     {id: 1, name: "First Sample Video 1293803.mp4"},
    //     {id: 2, name: "Second Sample Video random 5832400603844.mp4"},
    //     {id: 3, name: "Third Sample Video 9328403240402.mp4"}
    // ])


    const [ready, setReady] = useState(false)
    const videoRef = useRef(null)
    const progressRef = useRef(null)
    const [error, setError] = useState(null)
    
    const [progressProps, setProgressProps] = useState({
        name: null, percent: 0
    })


    // CALL THIS FUNCTION ON FILE CHANGE
    const handleFileChange = (e) => {

        if(e.target.files.length > 3) {
            setError("Maximum of 3 files can be selected");
            return;
        }

        if(e.target.files.length <= 1) {
            setError("Two or more files must be selected");
            return;
        }

        let files = [];
        const len = e.target.files.length;

        for(let i = 0; i < len; i++) {

            let file = e.target.files[i]
            let fileExtension = file.name.slice(file.name.lastIndexOf(".") + 1, )
            let fileSizeInMB = Math.ceil(file.size / ONE_MB)

            // File Size Limit -> 500 MB
            if(validTypes.includes(fileExtension)) {

                if(fileSizeInMB <= 500) {
                    // File is valid
                    files = [...files, file];

                    // If last file is also valid
                    if(i === (len-1)) {
                        setReady(true);
                        setSelectedFiles(files);
                        return;
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
    }


    // Request to process the uploaded video and return metadata
    const mergeVideos = () => {

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
        `${BASE_URL}/api/merge-videos`,
        {
            method: "POST",
            body: JSON.stringify({
            fileNames: modifiedFileNames,
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
            alert("Some Error!");
            return;
        }

        })
        .catch((err) => {
            console.log(err);
            alert("Some Error!");
        })

    }

    // CALL THIS FUNCTION FOR EACH CHUNK
    const uploadChunk = (index, isLastChunk) => {

        // If the current chunk is first chunk of the file, set progress percentage to zero
        if(index === 0) {
            progressRef.current.style.width = "0%"
        }

        let chunk = selectedFiles[currentFileUploadIndex].slice(index*(ONE_MB*15), (index+1)*(ONE_MB*15))

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
                "file-name": modifiedFileNames[currentFileUploadIndex],
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

                        setProgressProps({...progressProps, name: null, percent: 0})

                        // SEND DATA TO merge-video ROUTE AFTER ALL FILES HAVE BEEN UPLOADED
                        // CALL mergeVideo() FUNCTION
                        if(currentFileUploadIndex === (selectedFiles.length - 1)) {
                            console.log("ALL FILES UPLOADED");
                            setProgress(false)
                            setProgressProps({...progressProps, name: null, percent: 0})

                            mergeVideos()
                        }   
                        else {

                            // IF FILES ARE LEFT TO BE UPLOADED
                            // Change the currentFileUploadIndex and call startUpload() function
                        
                            currentFileUploadIndex++;
                            startUpload(0);
                            
                        }   
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
        let fileSize = Math.round(selectedFiles[currentFileUploadIndex].size / ONE_MB)
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

        console.log("INSIDE START UPLOAD PROGRESS PROPS");
        console.log(progressProps);
    
        setError(null)
        // We add a random 4 digit number before the fileName to prevent errors
        // due to existing filenames
        // We have to choose a random number only once, so we do that in this function 
        // and not in upload functions
        const randomNumber = Math.round(Math.random() * 10000).toString();
        modifiedFileNames[currentFileUploadIndex] = randomNumber + "-" + selectedFiles[currentFileUploadIndex].name; 
    
        setProgressProps((prevState) => {
          prevState.name = `Uploading file ${currentFileUploadIndex + 1}`
          prevState.percent = 0
          return prevState
        })
        setProgress(true)
    
        setTimeout(() => {
          handleUpload(index)
        }, 500)
        
    }

    const handleUploadButtonClick = () => {

        startUpload(0);

    }


    return (
        <div>
            <div className='merge-videos-title'>
                <div className='back-btn' onClick={() => handleOptionSelect("Options")}>
                    <i className='fa-solid fa-angle-left'></i>
                </div>
                <div>
                    <span>Merge Videos</span>
                </div>
            </div>
            <div className="merge-videos-body">
                <div className='file-input-div'>
                    <p>Select Video Files</p>
                    <input type='file'id='file-input' multiple={true} 
                    onChange={(e) => handleFileChange(e)}
                    disabled={progress}
                    />
                    <label htmlFor='file-input'>
                    Choose Files
                    </label>
                    <div className="selected-files">
                    {selectedFiles.length !== 0 ? 
                     
                        selectedFiles.map((file, index) => {
                            const {name} = file;
                            let newName = "";

                            if(name.length <= 34) {
                                newName = name
                            }
                            else {
                                newName = name.slice(0,15) + "..." + name.slice(-12, )
                            }
                            return(
                                <span key={index}>{newName}</span>
                            )
                        })
                    : <p>No files selected!</p>
                    }
                    </div>
                </div>
                <div className='note-section'>
                    <span>*</span>
                    <p>Maximum of 3 video files can be merged</p>
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
                            ref={progressRef} style={{width: "0%"}}
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

export default MergeVideos;