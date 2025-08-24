const express = require("express")
const cors = require("cors")
const fs = require("fs")
const ffmpegStatic = require("ffmpeg-static")
const ffmpeg = require("fluent-ffmpeg")
const path = require("path")
require("dotenv").config()

ffmpeg.setFfmpegPath(ffmpegStatic)

const app = express()

app.use(cors({origin: "*"}))
app.use(express.json())

//app.use("/output", express.static(path.join(__dirname, "output")))

let currentProgressPercent = 0

app.get("/", (req, res) => {
    res.send("Hello World!")
})

app.get("/test", (req, res) => {
    if(req.headers.accept === "text/event-stream") {
        res.writeHead(200, {
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'text/event-stream'
        })

        setInterval(() => {
            let n = Math.floor(Math.random() * 10000)
            let a = Math.floor(Math.random() * 10)
            res.write(`id: ${n}\n`)
            res.write(`data: ${a}\n\n`)
        }, 2000)
    }
    else {
        console.log("Event Stream no accepted!")
    }
})

app.get("/api/test", (req, res) => {
    
    ffmpeg()
        .input("images/SAMPLE.mp4")
        .outputOptions("-ss", "0", "-to", "10", "-ab", "256k")
        //.videoCodec("libx264")
        //.outputOptions("-pix_fmt", "yuv420p")
        .saveToFile("images/audioFormat.mp3")
        .on("progress", (progress) => {
            if(progress.percent) {
                let a = Math.floor(progress.percent)
                console.log("Progress: ", a)
            }
        })
        .on("end", () => {
            console.log("DONE!")
            res.send({message: "PROCESSING SUCCESS"})

        })
        .on("error", (err) => {
            console.log(err)
            res.send({message: "PROCESSING FAILED"})
        })
})

// SSE FOR REAL-TIME PROGRESS UPDATES TO THE FRONT-END
app.get("/api/progress", (req, res) => {
    if(req.headers.accept === "text/event-stream") {
        res.writeHead(200, {
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'text/event-stream'
        })

        let intervalId = setInterval(() => {
            let n = Math.floor(Math.random() * 10000)

            if(currentProgressPercent === 100) {
                res.write(`id: ${n}\n`)
                res.write(`data: ${currentProgressPercent}\n\n`)

                // WE WILL CLOSE CONNECTION FROM THE FRONT-END
                //clearInterval(intervalId)
                //res.end()
            }
            else {
                res.write(`id: ${n}\n`)
                res.write(`data: ${currentProgressPercent}\n\n`)
            }
        }, 1000)
    }
    else {
        console.log("Event Stream no accepted!")
    }
})


// SERVING VIDEO FILES WHEN VIDEO DOWNLOAD URL IS OPENED

app.get("/output/:filename", (req, res) => {

    let fileName = req.params.filename

    const readStream = fs.createReadStream(`output/${fileName}`)


    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
    /*

        Content-Disposition set to 'inline' will just serve the file provided that
        the Content-Type is not set to 'application/octet-stream' but to mime-type 
        refering to the file being served

    */
    res.setHeader('Content-Type', 'application/octet-stream')

    /*In place of application/octet-stream we can also define explicitly -

        audio/mpeg - For mp3 audio files
        video/mp4 - For mp4 video files
        image/png, image/jpeg - For image files

    */

    /*
    ALTERNATIVE WAY

    res.writeHead(200, {
        'Content-Disposition': 'attachment; filename="Database Indexing.mp3"',
        'Content-Type': 'application/force-download'
    })

    */
    
    readStream.on("data", (chunk) => {
        res.write(chunk)
    })
    readStream.on("error", (err) => {
        console.log("Read Stream Error!")
    })
    readStream.on("end", () => {
        console.log("END")
        res.end()
    })
    readStream.on("close", () => {
        console.log("CLOSED")
    })

    /*
    WE CAN DO JUST -> readStream.pipe(res)
    */
})

// ALL FILES WILL BE UPLOADED TO THIS ROUTE
app.post("/api/upload", (req, res) => {

    const fileExtension = req.headers["file-extension"]
    let fileName = req.headers["file-name"]
    const isLastChunk = req.headers["is-last-chunk"]
    const newWidth = req.headers["new-width"]
    const newHeight = req.headers["new-height"]

    let ws = fs.createWriteStream(`videos/${fileName}`, {flags: "a+", highWaterMark: 1024*64 })
  

    req.on("data", (chunk) => {
        
        let canContinue = ws.write(chunk, (err) => {
            if(err) {
                console.log("Write Error!")
                return
            }
        })

        if(!canContinue) {
            req.pause()
            ws.once("drain", () => {
                req.resume()
            })
        }
    })
    ws.on("error", (err) => {
        console.log("WS Error")
    })
    req.on("end", () => {
        console.log("Request End");
        console.log("IS LAST CHUNK: ", isLastChunk);
    })
    req.on("close", () => {
        console.log("Request Closed")
        let msg = isLastChunk === 'true' ? "LAST CHUNK" : "NOT LAST CHUNK"

        res.send({message: msg})
        
    })
    req.on("error", (err) => {
        console.log("Request Error!")
    })

})

// CHANGE RESOLUTION
app.post("/api/change-resolution", (req, res) => {

    const {fileName} = req.body
    const {newWidth} = req.body
    const {newHeight} = req.body

    let outputFileName = `${newWidth}x${newHeight}-${fileName}`
    let outputFileUrl = `http://localhost:5000/output/${outputFileName}`

    console.log("FILE NAME: ", fileName)
    console.log("New Width: ", newWidth)
    console.log("New Height: ", newHeight)
    
    ffmpeg()
        .input(`videos/${fileName}`)
        .outputOptions("-vf", `scale=${newWidth}:${newHeight}`)
        .saveToFile(`output/${outputFileName}`)
        .on("progress", (progress) => {
            if(progress.percent) {
    
                currentProgressPercent = Math.round(progress.percent)
                console.log("Progress: ", currentProgressPercent)
            }
        })
        .on("end", () => {

            currentProgressPercent = 100;

            // SEND fileName, fileURL, fileSize TO FRONTEND
            const fileStats = fs.statSync(`output/${outputFileName}`);
            // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
            const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));

            console.log("PROCESSING SUCCESS");

            res.send({message: "PROCESSING SUCCESS", 
            fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })
        })
        .on("error", (err) => {
            console.log("Some Error!")
            console.log(err);
            res.send({message: "PROCESSING FAILED"})
        })
        

})

// EXTRACT AUDIO
app.post("/api/extract-audio", (req, res) => {

    const {fileName} = req.body
    const {startDuration} = req.body
    const {endDuration} = req.body
    const {audioBitrate} = req.body
    const {extractEntireAudio} = req.body

    let fileNameWithoutExtension = fileName.slice(0, -4)  
    let outputFileName = fileNameWithoutExtension + ".mp3"

    let outputFileUrl = `http://localhost:5000/output/${outputFileName}`

    if(extractEntireAudio) {

        // Can also use seek() and duration() methods instead of -ss and to flags
        ffmpeg()
        .input(`videos/${fileName}`)
        .outputOptions("-ab", `${audioBitrate}k`)
        .saveToFile(`output/${outputFileName}`)
        .on("progress", (progress) => {
            if(progress.percent) {

                currentProgressPercent = Math.round(progress.percent)
                console.log("Progress: ", currentProgressPercent)
            }
        })
        .on("end", () => {
            console.log("PROCESSING END!")

            currentProgressPercent = 100;
            // SEND fileName, fileURL, fileSize TO FRONTEND
            const fileStats = fs.statSync(`output/${outputFileName}`);
            // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
            const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));

            res.send({message: "PROCESSING SUCCESS", 
            fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })
        })
        .on("error", (err) => {
            console.log("Some Error!")
            console.log(err);

            currentProgressPercent = 100;
            res.send({message: "PROCESSING FAILED"})
        })
        
    }
    else {
        // Can also use seek() and duration() methods instead of -ss and to flags
        ffmpeg()
        .input(`videos/${fileName}`)
        .outputOptions("-ss", `${startDuration}`, "-to", `${endDuration}`, "-ab", `${audioBitrate}k`)
        .saveToFile(`output/${outputFileName}`)
        .on("progress", (progress) => {
            if(progress.percent) {

                currentProgressPercent = Math.round(progress.percent)
                console.log("Progress: ", currentProgressPercent)
            }
        })
        .on("end", () => {
            console.log("PROCESSING END!")

            currentProgressPercent = 100;
            // SEND fileName, fileURL, fileSize TO FRONTEND
            const fileStats = fs.statSync(`output/${outputFileName}`);
            // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
            const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));

            res.send({message: "PROCESSING SUCCESS", 
            fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })
        })
        .on("error", (err) => {
            console.log("Some Error!")
            console.log(err);

            currentProgressPercent = 100;
            res.send({message: "PROCESSING FAILED"})
        })
    }    
        

})

function convertToSeconds(duration) {
    const [hours, minutes, seconds] = duration.split(":").map(Number);

    return hours * 3600 + minutes * 60 + seconds;
}

// EXTRACT VIDEO
app.post("/api/extract-video", (req, res) => {

    const {fileName} = req.body;
    const {startDuration} = req.body;
    const {endDuration} = req.body;
    const {extractEntireVideo} = req.body;

    let fileNameWithoutExtension = fileName.slice(0, -4)  
    let outputFileName = fileNameWithoutExtension + ".mp4"

    let outputFileUrl = `http://localhost:5000/output/${outputFileName}`

    console.log("EXTRACT ENTIRE VIDEO: ", extractEntireVideo);

    if(extractEntireVideo) {

        ffmpeg()
        .input(`videos/${fileName}`)
        .outputOptions("-an")
        .output(`output/${outputFileName}`)
        .on("progress", (progress) => {

            if(progress.percent) {
                currentProgressPercent = Math.round(progress.percent)
                console.log("Progress: ", currentProgressPercent);
            }
        })
        .on("end", () => {
            console.log("PROCESSING END");

            currentProgressPercent = 100;
            // SEND fileName, fileURL, fileSize TO FRONTEND
            const fileStats = fs.statSync(`output/${outputFileName}`);
            // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
            const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));

            res.send({message: "PROCESSING SUCCESS", 
            fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })
        })
        .on("error", (err) => {
            console.log("Some Error!");
            console.log(err);
        
            currentProgressPercent = 100;
            res.send({message: "PROCESSING FAILED"})
        })
        .run()
    }
    else {
        ffmpeg()
        .input(`videos/${fileName}`)
        .seek(convertToSeconds(startDuration))
        .duration(convertToSeconds(endDuration) - convertToSeconds(startDuration))
        .outputOptions("-an")
        .output(`output/${outputFileName}`)
        .on("progress", (progress) => {

            if(progress.percent) {
                currentProgressPercent = Math.round(progress.percent)
                console.log("Progress: ", currentProgressPercent);
            }
        })
        .on("end", () => {
            console.log("PROCESSING END");

            currentProgressPercent = 100;
            // SEND fileName, fileURL, fileSize TO FRONTEND
            const fileStats = fs.statSync(`output/${outputFileName}`);
            // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
            const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));

            res.send({message: "PROCESSING SUCCESS", 
            fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })
        })
        .on("error", (err) => {
            console.log("Some Error!")
            console.log(err);

            currentProgressPercent = 100;
            res.send({message: "PROCESSING FAILED"})
        })
        .run()
    }
})


// EXTRACT FRAME
app.post("/api/extract-frame", (req, res) => {

    const {fileName} = req.body;
    const {time} = req.body;
    
    let fileNameWithoutExtension = fileName.slice(0, -4)  
    let outputFileName = fileNameWithoutExtension + ".jpg"

    let outputFileUrl = `http://localhost:5000/output/${outputFileName}`

    ffmpeg()
    .input(`videos/${fileName}`)
    .outputOptions("-ss", `${convertToSeconds(time)}`, "-frames", "1")
    .saveToFile(`output/${outputFileName}`)
    .on("progress", (progress) => {

        if(progress.percent) {
            currentProgressPercent = Math.round(progress.percent)
            console.log("Progress: ", currentProgressPercent);
        }
    })
    .on("end", () => {
        console.log("PROCESSING END");

        currentProgressPercent = 100;
        // SEND fileName, fileURL, fileSize TO FRONTEND
        const fileStats = fs.statSync(`output/${outputFileName}`);
        // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
        const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));

        res.send({message: "PROCESSING SUCCESS", 
        fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })
    })
    .on("error", (err) => {
        console.log("Some Error!")
        console.log(err);

        currentProgressPercent = 100;
        res.send({message: "PROCESSING FAILED"})
    })
})


// CONVERT TO GIF
app.post("/api/convert-to-gif", (req, res) => {

    const {fileName} = req.body;
    const {convertEntireVideo} = req.body;
    const {gifQuality} = req.body;
    const {videoDuration} = req.body;


    let fileNameWithoutExtension = fileName.slice(0, -4)  
    let outputFileName = fileNameWithoutExtension + ".gif"

    let outputFileUrl = `http://localhost:5000/output/${outputFileName}`

    ffmpeg()
    .input(`videos/${fileName}`)
    .output(`output/${outputFileName}`)
    .seek(0)
    .duration(convertEntireVideo ? videoDuration : 6)
    .outputOptions("-vf", `fps=20, scale=-2:${gifQuality}`)
    .on("progress", (progress) => {

        if(progress.percent) {
            currentProgressPercent = Math.round(progress.percent)
            console.log("Progress: ", currentProgressPercent);
        }
    })
    .on("end" ,() => {
        
        console.log("PROCESSING END");

        currentProgressPercent = 100;
        // SEND fileName, fileURL, fileSize TO FRONTEND
        const fileStats = fs.statSync(`output/${outputFileName}`);

        // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
        const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));

        res.send({message: "PROCESSING SUCCESS", 
        fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })

    })
    .on("error", (err) => {
        console.log("Some Error");
        console.log(err);

        currentProgressPercent = 100;
        res.send({message: "PROCESSING FAILED"});
    })
    .run()

})


// EXTRACT GIF
app.post("/api/extract-gif", (req, res) => {

    const {fileName} = req.body;
    const {startDuration} = req.body;
    const {endDuration} = req.body;
    const {gifQuality} = req.body;

    let fileNameWithoutExtension = fileName.slice(0, -4)  
    let outputFileName = fileNameWithoutExtension + ".gif"

    let outputFileUrl = `http://localhost:5000/output/${outputFileName}`

    const gifDuration = 
    (convertToSeconds(endDuration) - convertToSeconds(startDuration)) > 6 ? 6 : 
    (convertToSeconds(endDuration) - convertToSeconds(startDuration))

    ffmpeg()
    .input(`videos/${fileName}`)
    .output(`output/${outputFileName}`)
    .seek(convertToSeconds(startDuration))
    .duration(gifDuration)
    .outputOptions("-vf", `fps=20, scale=-2:${gifQuality}`)
    .on("progress", (progress) => {

        if(progress.percent) {
            currentProgressPercent = Math.round(progress.percent)
            console.log("Progress: ", currentProgressPercent);
        }
    })
    .on("end" ,() => {
        
        console.log("PROCESSING END");

        currentProgressPercent = 100;
        // SEND fileName, fileURL, fileSize TO FRONTEND
        const fileStats = fs.statSync(`output/${outputFileName}`);

        // TO DELETE THE ORIGINAL FILE AFTER PROCESSING

        // fs.unlink(`videos/${fileName}`, (err) => {
        //     if(err) {
        //         console.log("ERROR DELETING FILE!");
        //         return;
        //     }
        //     console.log("FILE DELETED");
        // })

        // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
        const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));

        res.send({message: "PROCESSING SUCCESS", 
        fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })

    })
    .on("error", (err) => {
        console.log("Some Error");
        console.log(err);

        currentProgressPercent = 100;
        res.send({message: "PROCESSING FAILED"});
    })
    .run()
})


// TRIM VIDEO
app.post("/api/trim-video", (req, res) => {

    const {fileName} = req.body;
    const {startDuration} = req.body;
    const {endDuration} = req.body;

    let fileNameWithoutExtension = fileName.slice(0, -4)  
    let outputFileName = fileNameWithoutExtension + ".mp4"

    let outputFileUrl = `http://localhost:5000/output/${outputFileName}`

    ffmpeg()
        .input(`videos/${fileName}`)
        .seek(convertToSeconds(startDuration))
        .duration(convertToSeconds(endDuration) - convertToSeconds(startDuration))
        .output(`output/${outputFileName}`)
        .on("progress", (progress) => {

            if(progress.percent) {
                currentProgressPercent = Math.round(progress.percent);
                console.log("Progress: ", currentProgressPercent);
            }
        })
        .on("end" ,() => {
            
            console.log("PROCESSING END");
    
            currentProgressPercent = 100;
            // SEND fileName, fileURL, fileSize TO FRONTEND
            const fileStats = fs.statSync(`output/${outputFileName}`);
    
            // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
            const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));
    
            res.send({message: "PROCESSING SUCCESS", 
            fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })
    
        })
        .on("error", (err) => {
            console.log("Some Error");
            console.log(err);
    
            currentProgressPercent = 100;
            res.send({message: "PROCESSING FAILED"});
        })
        .run()
})


// MERGE VIDEOS
app.post("/api/merge-videos", async (req, res) => {
    const {fileNames} = req.body;

    console.log(fileNames);
    // First, create a text file containing fileNames in the following way
    // file 'input1.mp4'
    // file 'input2.mp4'
    // ...
    let dataString = "";
    const textFileName = Math.round(Math.random() * 1_000_000).toString() + ".txt"

    for(const fileName of fileNames) {
        
        dataString += `file '${fileName}'\n`;
    }


    try {

        fs.writeFileSync(`videos/${textFileName}`, dataString);

        console.log("Data Written");

        let fileNameWithoutExtension = fileNames[0].slice(0, 10) + " and others";   
        let outputFileName = fileNameWithoutExtension + ".mp4"

        let outputFileUrl = `http://localhost:5000/output/${outputFileName}`
        
        let textFilePath = path.join(__dirname, "videos", textFileName);

        ffmpeg()
        .input(textFilePath)
        .inputOptions(["-f concat"])
        .output(`output/${outputFileName}`)
        .on("progress", (progress) => {

            if(progress.percent) {
                currentProgressPercent = Math.round(progress.percent);
                console.log("Progress: ", currentProgressPercent);
            }
        })
        .on("end" ,() => {
            
            console.log("PROCESSING END");
    
            currentProgressPercent = 100;
            // SEND fileName, fileURL, fileSize TO FRONTEND
            const fileStats = fs.statSync(`output/${outputFileName}`);
    
            // ROUND OFF FILE SIZE TO 2 DECIMAL PLACES
            const fileSizeInMB = parseFloat((fileStats.size / 1048576).toFixed(2));
    
            res.send({message: "PROCESSING SUCCESS", 
            fileName: outputFileName, fileURL: outputFileUrl, fileSize: fileSizeInMB })
    
        })
        .on("error", (err) => {
            console.log("Some Error");
            console.log(err);
    
            currentProgressPercent = 100;
            res.send({message: "PROCESSING FAILED"});
        })
        .run()
        
    } catch (error) {
    
        res.send({message: "Error writing text file"})
    }

})

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server Listening on Port ${PORT}`);
})