const ONE_MB = 1048576
const BASE_URL = "http://localhost:5000"

let tempFile = null


export function generateNumber(multiplier, setRandomNumber) {
    let n = Math.floor(Math.random() * multiplier)
    setRandomNumber(n)
    return n
}

export function startUpload(index, setError, setProgressProps, setProgress, 
    selectedFile, progressPerUnitChunk, progressRef, progressProps, processingFunction) {

    if(index ===  0) {
        tempFile = selectedFile
    }    

    // Params required - index, setError, setProgressProps, setProgress
    
    console.log("INSIDE START UPLOAD")

    console.log(tempFile)
    console.log(selectedFile)

    setError(null)

    setProgressProps((prevState) => {
      prevState.name = "Uploading file"
      prevState.percent = 0
      return prevState
    })
    setProgress(true)

    setTimeout(() => {
      handleUpload(index, progressPerUnitChunk, setProgressProps, 
        progressRef, setProgress, setError, progressProps, processingFunction)
    }, 500)
    
    
}

export function handleUpload(index, progressPerUnitChunk,setProgressProps, 
                progressRef, setProgress, setError, progressProps, processingFunction) {
    // Params - selectedFile.size, ONE_MB, progressPerUnitChunk

    // File Size in Mega Bytes
    let fileSize = Math.round(tempFile.size / ONE_MB)
    //console.log("File Size(MB): ", fileSize)

    // Decide how many 15MB chunks the file has
    let numberOfChunks = Math.ceil(fileSize / 15)
    progressPerUnitChunk = 100/numberOfChunks


    if(index >= numberOfChunks) {
      console.log("All Chunks Uploaded!")
      return
    }
    
    if(index === numberOfChunks - 1) {
        uploadChunk(index, true, progressPerUnitChunk, 
            setProgressProps, progressRef, setProgress, setError, progressProps, processingFunction)
    }
    else {
        uploadChunk(index, false, progressPerUnitChunk, 
            setProgressProps, progressRef, setProgress, setError, progressProps, processingFunction)
    }

}

// CALL THIS FUNCTION FOR EACH CHUNK
export function uploadChunk(index, isLastChunk, progressPerUnitChunk,
                    setProgressProps, progressRef, setProgress,
                    setError, progressProps, processingFunction) {

    // Params - ONE_MB, selectedFile, BASE_URL, progressPerUnitChunk, setProgressProps, progressRef, 
    // setProgress, setError
    // Last - processingFunction() -> Different for all 

    let chunk = tempFile.slice(index*(ONE_MB*15), (index+1)*(ONE_MB*15))

    const fileReader = new FileReader()

    fileReader.onload = (e) => {
      
    }
    fileReader.onloadend = (e) => {
      let result = e.target.result
      let byteLength = e.target.result.byteLength

      console.log("INDEX: ", index)
      console.log("CHUNK SIZE(MB): ", byteLength/ONE_MB)
      console.log("IS LAST CHUNK: ", isLastChunk)

      
      fetch(
        `${BASE_URL}/api/upload`,
        {
          body: result,
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "file-name": tempFile.name,
            "is-last-chunk": isLastChunk,
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

            // SEND DATA TO extract-audio ROUTE AFTER FILE HAS BEEN UPLOADED
            // CALL PROCESSING FUNCTION
            processingFunction()
          }, 500)

  
          return
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


