/************************************
 Copyright (c) 2012, Intel Corporation
 All rights reserved.
 
 Redistribution and use in source and binary forms, with or without 
 modification, are permitted provided that the following conditions are met:

 - Redistributions of source code must retain the above copyright notice, 
   this list of conditions and the following disclaimer.
 - Redistributions in binary form must reproduce the above copyright notice, 
   this list of conditions and the following disclaimer in the documentation 
   and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE 
 LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
 CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
 SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS 
 INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
 ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF 
 THE POSSIBILITY OF SUCH DAMAGE.
************************************/

/*
 * Main.js: driver script for applying filters
 * @author: Jaswanth Sreeram
 */

function endit() {
    webcam_source.endRecording();
    webcam_source.endSession();
    return "Your webcam session has ended";
}
window.onbeforeunload = endit;

var frames = 0;
var elapsed = 0;
var input_canvas;
var input_context;
var output_canvas;
var output_context;
var webcam_on;
var video_on;
var video_source;
var webcam_source = window.navigator.service.media; 
var kernels;
var execution_mode;
var prevFrame;
var hist_canvas;
var hist_context;
//var hist_on = false;
var numActiveFilters = 0;
var chimp;
var cached_dims = [];

function toggleExecutionMode() {
    if(execution_mode === "parallel") {
        execution_mode = "sequential";
        //hist_on = true;
    }
    else {
        execution_mode = "parallel";
        //hist_on = false;
    }
    frames = 0;
    elapsed = 0;
}



function pauseWebCamInput() {
    webcam_on = false;
    frames = 0;
    elapsed = 0;
    input_canvas = document.getElementById("output");
    input_context = input_canvas.getContext("2d");
    output_context.clearRect(0, 0, output_canvas.width, output_canvas.height);
    webcam_source.endSession();
}
function startWebCamInput() {
    frames = 0;
    elapsed = 0;
    if(webcam_on) {
        alert("Camera is already on");
        return;
    }
    input_canvas = document.getElementById("webcaminput");
    input_context = input_canvas.getContext("2d");

    var outputdiv = document.getElementById("outputdiv");
    outputdiv.style.width = input_canvas.width;
    outputdiv.style.height = input_canvas.height;

    
    cached_dims[0] = output_canvas.width;
    cached_dims[1] = output_canvas.height;

    output_canvas.style.width=input_canvas.width;
    output_canvas.style.height=input_canvas.height;

    output_canvas.width=input_canvas.width;
    output_canvas.height=input_canvas.height;

    var camera_options = {audio:false, video:true, width:input_canvas.width, height:input_canvas.height};
    output_context.clearRect(0, 0, output_canvas.width, output_canvas.height);
    webcam_on = true;
    webcam_source.beginSession(camera_options, input_context, onStateChange);
}

function toggleUseWebcam() {
    frames = 0;
    elapsed = 0;
    if(webcam_on) {
        pauseWebCamInput();
    }
    else {
        if(!(video.paused || video.ended)) {
            video.pause();
            video_on = false;
        }
        startWebCamInput();
    }
}

function toggleKernel(id) {
    frames = 0; elapsed = 0;
    for(var i = 0; i < kernels.length; i++) {
        if(kernels[i].name === id) {
            numActiveFilters += kernels[i].enabled ? -1 : 1;
            kernels[i].enabled = !(kernels[i].enabled);
            return kernels[i].enabled;
        }
    }
    return false;
}

function initKernels() {
    var pchecked = $('#parallel').attr('checked');
    if(pchecked === "checked") {
        execution_mode = "parallel"
    }
    else {
        execution_mode = "sequential";
    }
    console.log("Execution mode is ", execution_mode);
    kernels = [
        {name:"sepia", enabled:false},
        {name:"lighten", enabled:false},
        {name:"color_adjust", enabled:false},
        {name:"desaturate", enabled:false},
        {name:"edge_detect", enabled:false},
        {name:"sharpen", enabled:false},
        {name:"face_detect", enabled:false},
        {name:"A3D", enabled:false},
        ];
    numActiveFilters = 0;
}
function doLoad() {
    video = document.getElementById("video");
    output_canvas = document.getElementById("output");
    output_context = output_canvas.getContext("2d");
    input_canvas = output_canvas;
    input_context = output_context;
   
    chimp = document.getElementsByTagName('img')[0]; 
   

    hist_canvas = document.getElementById("hist");
    hist_context = hist_canvas.getContext("2d");

    webcam_on = false;

    output_context.font      = '40px calibri';
    output_context.textAlign = 'center';
    output_context.fillStyle = '#888888'
    output_context.fillText("Click to play/pause", 450, 250);
    output_context.lineWidth = 5;
    output_context.strokeStyle = "rgba(20,254,0,1)";
    frames = 0;
    elapsed = 0;
    initKernels();
    filters = Filters;
    $("#sepia, #lighten, #desaturate, #color_adjust, #edge_detect, #sharpen, #face_detect").removeClass("ui-state-active").button("refresh");

    output_canvas.addEventListener("click", function() {
        frames = 0; elapsed = 0;
        
        if(webcam_on)
            return;
        if(video_on) {
            video.pause();
            video_on = false;
            frames = 0; elapsed = 0;
            return;
        }
        else {
            video.play();
            video_on = true;
            frames = 0; elapsed = 0;
            computeFrame();
        }
    }, false);
}
function setKernels(oldfilter, newfilter) {
        var len = kernels.length;
        for(var i = 0; i < len; i++) {
            if(kernels[i].name === oldfilter) {
                kernels[i].enabled = false;
            }
            else if(kernels[i].name === newfilter) {
                kernels[i].enabled = true;
            }
        }
        frames = 0; elapsed = 0;

}

/* This space is here for padding */













function computeFrame() {
    var start_time;
    var frame;
    var len;
    var stage_output, stage_input;
    var w, h;
    if((!webcam_on) && (!video_on))
        return;
    if(video_on) {
        output_context.drawImage(video, 0, 0, output_canvas.width, output_canvas.height);
    }

    if(frames > 0)
        start_time = new Date().getTime();
    if (execution_mode === "sequential" || (numActiveFilters === 0)) {
        frame = input_context.getImageData(0, 0, input_canvas.width, input_canvas.height);
        len = frame.data.length;
        w = frame.width; h = frame.height;
    } else if (execution_mode === "parallel") {
        frame = output_context.getImageData(0, 0, input_canvas.width, input_canvas.height);
        stage_output = stage_input = new ParallelArray(input_canvas);
        w = input_canvas.width; h = input_canvas.height;
    }


    var kernelName = "";
    var filterName = "";
    var kernelExtraArgs ;
    var face_pa;
    var nw = w; var nh = h;
    for(var stage = 0; stage < kernels.length; stage++) {
        if(numActiveFilters === 0)
            break;
        if(!kernels[stage].enabled)
            continue;
        filterName = kernels[stage].name;
        kernelName = filters[filterName + "_" + execution_mode];
        if(execution_mode === "parallel") {
            switch(filterName) {
                case "sepia":
                case "lighten":
                case "desaturate":
                case "color_adjust":
                case "edge_detect":
                case "sharpen":
                case "A3D":
                    break;
                case "face_detect":
                    face_pa = new ParallelArray([h, w], kernelName, stage_input, w, h);
                    dofaceparallel(face_pa, w, h, stage_input, output_context, w, h);
                    stage_output = stage_input;
                    break;
                default:
            }
            // Make this filter's output the input to the next filter
            stage_input = stage_output;
        }
        else if(execution_mode === "sequential") {
            switch(filterName) {
                case "lighten":
                    kernelName(frame, len, w, h, color_input["grey"], output_context);
                    break;
                case "color_adjust":
                    kernelName(frame, len, w, h, color_input["red"], color_input["green"], color_input["blue"], output_context);
                    break;
                case "A3D":
                    kernelName(frame, len, w, h, g_dist, output_context);
                    break;
                default:
                    kernelName(frame, len, w, h, output_context);

            }
        }
    }
    if(numActiveFilters === 0) {
        output_context.putImageData(frame, 0, 0);
    }
    else if(execution_mode === "parallel") {
        switch(filterName) {
            case "face_detect":
                break;
            default:
                stage_output.materialize();
                var so_data = stage_output.data;
                var so_len = so_data.length;
                var f_data = frame.data;
                for(var i = 0; i < so_len; i++) {
                    f_data[i] = so_data[i];
                }
                //frame.data.set(stage_output.data);
                output_context.putImageData(frame, 0, 0);
        }
    }
    //if(hist_on)
    //    drawHistogram(frame.data, len, w, h);
    if(frames > 0) {
        frame_time = new Date().getTime() - start_time;
        elapsed += frame_time;
    }
    frames++;
    if(frames < 10) {
        document.getElementById("text1").innerHTML= "--";
    }
    else {
        document.getElementById("text1").innerHTML= Math.floor((frames-1)/(elapsed/1000)) + " fps";
        //document.getElementById("text1").innerHTML= ((frames-1)/(elapsed/1000)).toFixed(1) + " fps";
    }
    setTimeout(function () {
        computeFrame();
    }, 0);
    return;
}

function onStateChange(type, arg) {
    switch (type) {
        case "session-began":
            webcam_on = true;
            computeFrame();
            break;
        case "record-began":
            webcam_on = true;
            break;
        case "record-ended":
            webcam_source.endSession();
            webcam_on = false;
            break;
        case "record-finished":
            webcam_on = false;
            break;
        case "session-ended":
            webcam_on = false;
            output_canvas.style.width=output_canvas.width=cached_dims[0];
            output_canvas.style.height=output_canvas.height=cached_dims[1];
            var outputdiv = document.getElementById("outputdiv");
            outputdiv.style.width = output_canvas.width;
            outputdiv.style.height = output_canvas.height;
            if(!video_on) {
                video_on = true;
                video.play();
            }
            computeFrame();
            break;
        case "error":
            alert("Webcam ERROR: " + type + " " + arg);
            break;
    }
}
