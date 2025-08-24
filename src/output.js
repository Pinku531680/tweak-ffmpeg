import React, {useState, useEffect} from 'react'
import "./App.css"


function Output({handleOptionSelect, targetFile}) {

    let BASE_URL = 'http://localhost:5000/output'

    let name = "SAMPLE.mp4"
    let _URL = `http://localhost:5000/output/Database Indexing.mp3`
    let size = 500

    const handleDownload = () => {

        console.log("Clicked")


        setTimeout(() => {
            window.open(targetFile.fileURL, "_blank")
            //window.open(`${BASE_URL}/${targetFile.fileName}`, "_blank")
        }, 300)
        

    }

    useEffect(() => {
        console.log("File Name: ", targetFile.fileName)
        console.log("File URL: ", targetFile.fileURL)
        console.log("File Size: ", targetFile.fileSize)
    }, [])

  return (
    <div>
        <div className='output-title'>
            <div className='back-btn' onClick={() => handleOptionSelect("Options")}>
              <i className='fa-solid fa-angle-left'></i>
            </div>
            <div>
              <span>Download file</span>
            </div>
        </div>
        <div className='output-title-body'>
            <div>
                <span>File name :</span>
                <p>{targetFile.fileName}</p>
            </div>
            <div>
                <span>File URL :</span>
                <p>{targetFile.fileURL}</p>
            </div>
            <div>
                <span>File size :</span>
                <p>{targetFile.fileSize} MB</p>
            </div>
            <div className='download-file-section'>
                <button onClick={handleDownload}>
                    Download
                </button>
            </div>
        </div>
    </div>
  )
}

export default Output