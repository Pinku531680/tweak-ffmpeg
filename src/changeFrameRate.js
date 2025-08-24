import React, {useState, useEffect, useRef} from 'react';
import "./changeFrameRate.css";


function ChangeFrameRate({handleOptionSelect, handleSetFileData}) {

  const [frameRate, setFrameRate] = useState(30);  // initially


  return (
    <div>
      <div className='change-framerate-title'>
            <div className='back-btn' onClick={() => handleOptionSelect("Options")}>
              <i className='fa-solid fa-angle-left'></i>
            </div>
            <div>
              <span>Change Frame Rate</span>
            </div>
        </div>
        <div className='change-framerate-body'>
            In Progress...
        </div>
    </div>
  )
}

export default ChangeFrameRate