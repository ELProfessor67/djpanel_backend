const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const path = require('path')
const { spawn } = require('child_process');


function mergeSongs(songPaths, outputPath) {
    return new Promise((resolve, reject) => {
        // Ensure the list of songs is not empty
        if (songPaths.length === 0) {
            return reject(new Error("No songs provided to merge."));
        }

        const ffmpegCommand = ffmpeg();

        // Add each song to the ffmpeg input
        songPaths.forEach(songPath => {
            ffmpegCommand.input(songPath);
        });

        // Set output file and encoding options
        ffmpegCommand
            .on('end', () => {
                console.log(`Merged file created at ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('Error while merging songs:', err);
                reject(err);
            })
            .mergeToFile(outputPath, path.dirname(outputPath)); // Save output file
    });
}

function areArraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
}

function getSongDuration(filePath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);
  
        let duration = '';
        ffprobe.stdout.on('data', (data) => {
            duration += data;
        });
  
        ffprobe.stderr.on('data', (data) => {
            reject(`ffprobe stderr: ${data}`);
        });
  
        ffprobe.on('close', (code) => {
            if (code === 0) {
                resolve(parseFloat(duration.trim()));
                
            } else {
                reject(`ffprobe process exited with code ${code}`);
            }
        });
    });
  }

module.exports = {mergeSongs,areArraysEqual,getSongDuration}