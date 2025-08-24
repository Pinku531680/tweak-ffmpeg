import React, {useState, useEffect} from 'react'
import "./App.css"


function Options({handleOptionSelect}) {

    const options = [
        {name: "Change Resolution", icon: "fa-solid fa-display"},
        {name: "Extract Audio", icon: "fa-solid fa-music"},
        {name: "Extract Video", icon: "fa-solid fa-video"},
        {name: "Extract Frame", icon: "fa-solid fa-film"},
        {name: "Convert to GIF", icon: "fa-solid fa-clapperboard"},
        {name: "Extract GIF", icon: "fa-solid fa-hands-clapping"},
        {name: "Trim Video", icon: "fa-solid fa-scissors"},
        {name: "Merge Videos", icon: "fa-solid fa-object-group"},
        {name: "Change Frame Rate", icon: "fa-solid fa-angles-up"}
    ]
    

  return (
    <div>
        <div className="options-title">
          <span>Video Manipulation Tools</span>
        </div>
        <div className="options">
            {
              options.map((option, index) => {
                  const {name, icon} = option
                  return(
                    <div className="option" key={index}
                    onClick={() => handleOptionSelect(name)}>
                      <div className="option-left">
                        <div className="option-icon">
                          <i className={icon}></i>
                        </div>
                        <div className="option-name">
                          <span>{name}</span>
                        </div>
                      </div>
                      <div className="option-right">
                        <div className="option-btn">
                          <i className="fa-solid fa-caret-right"></i>
                        </div>
                      </div>
                    </div>
                  )
              })
            }
        </div>
    </div>
  )
}

export default Options