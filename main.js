const actx = new (window.AudioContext || window.webkitAudioContext)();

function playFrequency(frequency = 440, gain = 0.1, time = 0.1) {
    const oscillator = actx.createOscillator();
    const gainNode = actx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(actx.destination);
    oscillator.type = "sine";

    gainNode.gain.value = gain;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = 0; //CENTS
    oscillator.start();
    oscillator.stop(actx.currentTime + time);
    var oscillator_object = {
        stop: function () {
            oscillator.stop(actx.currentTime);
            this.played = true;
        },
        oscillator,
        played: false,
    };
    playingNotes.push(oscillator_object);
    setTimeout(function () {
        oscillator_object.played = true;
    }, time * 1000);
    return oscillator_object;
    /*return new Promise(function (resolve, reject) {
      setTimeout(resolve, promisetime * 1000);
    });*/
}
function noteObject(sound, beat=current_selected_beat, long=moveStep, accidental = ACCIDENTALS.NATURAL){
    return {
        sound: sound,
        accidental: ACCIDENTALS.NATURAL,
        beat: current_selected_beat,
        long: moveStep
    }
}
var playingNotes = [];
const sharpFifthDataCache = {};
var canvas;
var ctx;
var playing = false;
var moveStep = 0.5;

var mainedo = 19;
var bpm = 100;
var current_selected_beat = 0;
var noteoffset_px = 0;
function getStepsFromA4(sound, accidental, edo = mainedo) {
    let { sharpValue, fifthStep } = edoSharpValFifth(edo);
    let soundline = mod7(sound);
    let temp1 = 0;
    if (soundline == 1) {
        temp1 = 2 * fifthStep - edo;
    }
    if (soundline == 2) {
        temp1 = -3 * fifthStep + edo * 2;
    }
    if (soundline == 3) {
        temp1 = -fifthStep + edo;
    }
    if (soundline == 4) {
        temp1 = fifthStep;
    }
    if (soundline == 5) {
        temp1 = -4 * fifthStep + edo * 3;
    }
    if (soundline == 6) {
        temp1 = -2 * fifthStep + edo * 2;
    }
    let octave = Math.floor(sound / 7);
    return (
        octave * edo +
        accidental.sharpCount * sharpValue +
        accidental.arrowCount +
        temp1
    );
}
function playNoteWithObject(obj, edo = mainedo, long = 0.5) {
    playFrequency(
        440 * 2 ** (getStepsFromA4(obj.sound, obj.accidental, edo) / edo),
        0.1,
        (60 / bpm) * long
    );
}
/*
note object:
sound (0=A4, -1=G4, -2=F4)
*/
function accidentalObject(sharpCount, arrowCount) {
    return {
        sharpCount,
        arrowCount,
    };
}
function naturalNotesSteps(edo = mainedo) {
    // return A4 B4 C5 D5 E5 F5 G5 steps;
    let result = [
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
    ];
    for (let i = 1; i < 7; i++) {
        result[i] = getStepsFromA4(i, ACCIDENTALS.NATURAL, edo);
    }

    return result;
}
function naturalAccNoteStepInLine(sound, edo = mainedo) {
    let octave = Math.floor(sound / 7);
    let line = mod7(sound);
    return naturalNotesSteps(edo)[line] + octave * edo;
}
function hasNaturalAccNoteAtStep(step, edo = mainedo) {
    let octave = Math.floor(step / edo);
    let stepme = mody(step, edo);
    let result = {
        hasNote: false,
        line: NaN,
    };
    let temp1 = naturalNotesSteps(edo).indexOf(stepme);
    if (temp1 == -1) return result;
    else {
        result.hasNote = true;
        result.line = temp1 + octave * 7;
    }
    return result;
}
const ACCIDENTALS = {
    NATURAL: accidentalObject(0, 0),
    SHARP: accidentalObject(1, 0),
    FLAT: accidentalObject(-1, 0),
    SHARP2: accidentalObject(2, 0),
    FLAT2: accidentalObject(-2, 0),
};
function mod7(x) {
    return x >= 0 ? x % 7 : 7 - (-x % 7);
}
function mody(x, y) {
    return x >= 0 ? x % y : y - (-x % y);
}
function edoSharpValFifth(edo = mainedo) {
    if (sharpFifthDataCache[edo]) {
        return {
            fifthStep: sharpFifthDataCache[edo].fifthStep,
            sharpValue: sharpFifthDataCache[edo].sharpValue,
        };
    }
    var val = [2, 3].map(function (q) {
        return Math.round((edo * Math.log(q)) / Math.LN2);
    });
    var fifthStep = -val[0] + val[1];
    var sharpValue = -11 * val[0] + 7 * val[1];
    sharpFifthDataCache[edo] = {
        fifthStep,
        sharpValue,
    };
    return {
        fifthStep,
        sharpValue,
    };
}
function noteup(noteobj, edo = mainedo, down = false) {
    let result = {
        sound: 0,
        accidental: accidentalObject(0, 0),
        beat: noteobj.beat,
    };
    //if (edo!= mainedo) throw Error("un12edo is not supported")
    let { sharpValue } = edoSharpValFifth(edo);
    result.sound = noteobj.sound;
    acc = accidentalObject(
        noteobj.accidental.sharpCount,
        noteobj.accidental.arrowCount
    );
    accidentalresult = accidentalObject(
        noteobj.accidental.sharpCount,
        noteobj.accidental.arrowCount
    );

    if (down) {
        acc.arrowCount--;
        accidentalresult.arrowCount--;
    } else {
        acc.arrowCount++;
        accidentalresult.arrowCount++;
    }

    /*nextLineStep = getStepsFromA4(
      result.sound + (down ? -1 : 1),
      ACCIDENTALS.NATURAL,
      edo
    );*/
    currentNoteStep = getStepsFromA4(result.sound, acc, edo);
    let { hasNote, line } = hasNaturalAccNoteAtStep(currentNoteStep);
    console.log(currentNoteStep, hasNote);
    if (hasNote) {
        result.sound = line;
        result.accidental = ACCIDENTALS.NATURAL;
    } else {
        if (down) {
            if (sharpValue != 0) {
                if (
                    sharpValue < 0 &&
                    acc.arrowCount == sharpValue &&
                    acc.sharpCount < 2
                )
                    accidentalresult = accidentalObject(acc.sharpCount + 1, 0);
                else if (
                    sharpValue > 0 &&
                    acc.arrowCount == -sharpValue &&
                    acc.sharpCount > -2
                )
                    accidentalresult = accidentalObject(acc.sharpCount - 1, 0);
                else if (
                    sharpValue > 0 &&
                    acc.arrowCount < -3 * sharpValue &&
                    acc.sharpCount > 0
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount - 3,
                        acc.arrowCount + sharpValue * 3
                    );
                else if (
                    sharpValue > 0 &&
                    acc.arrowCount < -2 * sharpValue &&
                    acc.sharpCount > -1
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount - 2,
                        acc.arrowCount + sharpValue * 2
                    );
                else if (
                    sharpValue > 0 &&
                    acc.arrowCount < -sharpValue &&
                    acc.sharpCount > -2
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount - 1,
                        acc.arrowCount + sharpValue
                    );
                else if (
                    sharpValue < 0 &&
                    acc.arrowCount < 3 * sharpValue &&
                    acc.sharpCount < 0
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount + 3,
                        acc.arrowCount - sharpValue * 3
                    );
                else if (
                    sharpValue < 0 &&
                    acc.arrowCount < 2 * sharpValue &&
                    acc.sharpCount < 1
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount + 2,
                        acc.arrowCount - sharpValue * 2
                    );
                else if (
                    sharpValue < 0 &&
                    acc.arrowCount < sharpValue &&
                    acc.sharpCount < 2
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount + 1,
                        acc.arrowCount - sharpValue
                    );
            }
        } else {
            if (sharpValue != 0) {
                if (
                    sharpValue > 0 &&
                    acc.arrowCount == sharpValue &&
                    acc.sharpCount < 2
                )
                    accidentalresult = accidentalObject(acc.sharpCount + 1, 0);
                else if (
                    sharpValue < 0 &&
                    acc.arrowCount == -sharpValue &&
                    acc.sharpCount > -2
                )
                    accidentalresult = accidentalObject(acc.sharpCount - 1, 0);
                else if (
                    sharpValue > 0 &&
                    acc.arrowCount > 3 * sharpValue &&
                    acc.sharpCount < 0
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount + 3,
                        acc.arrowCount - sharpValue * 3
                    );
                else if (
                    sharpValue > 0 &&
                    acc.arrowCount > 2 * sharpValue &&
                    acc.sharpCount < 1
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount + 2,
                        acc.arrowCount - sharpValue * 2
                    );
                else if (
                    sharpValue > 0 &&
                    acc.arrowCount > sharpValue &&
                    acc.sharpCount < 2
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount + 1,
                        acc.arrowCount - sharpValue
                    );
                else if (
                    sharpValue < 0 &&
                    acc.arrowCount > -3 * sharpValue &&
                    acc.sharpCount > 0
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount - 3,
                        acc.arrowCount + sharpValue * 3
                    );
                else if (
                    sharpValue < 0 &&
                    acc.arrowCount > -2 * sharpValue &&
                    acc.sharpCount > -1
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount - 2,
                        acc.arrowCount + sharpValue * 2
                    );
                else if (
                    sharpValue < 0 &&
                    acc.arrowCount > -sharpValue &&
                    acc.sharpCount > -2
                )
                    accidentalresult = accidentalObject(
                        acc.sharpCount - 1,
                        acc.arrowCount + sharpValue
                    );
            }
        }
        result.accidental = accidentalresult;
    }
    return result;
}
var selectednote = 0;
function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.stroke();
}
function lifeCycle() {
    let { sharpValue, fifthStep } = edoSharpValFifth(mainedo);
    ctx.fillStyle = "rgb(245, 245, 245)";
    ctx.strokeStyle = "rgb(0, 0, 0)";
    ctx.fillRect(0, 0, 700, 700);

    for (let i = 1; i < 6; i++) {
        drawLine(ctx, 0, 80 + i * 20, 700, 80 + i * 20);
    }

    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.font = "25px Arial";
    ctx.fillText("Mode: Treble", 2, 65);
    ctx.font = "15px Arial";
    ctx.fillText("BPM: " + bpm, 2, 230);
    6;
    ctx.fillText(
        "Current EDO(TET): " +
        mainedo +
        " (" +
        (sharpValue == 0
            ? "perfect"
            : sharpValue > 0
                ? `sharp-${sharpValue}`
                : `flat${sharpValue}`) +
        ")",
        2,
        245
    );

    ctx.font = "50px Arial";
    ctx.fillText("4", 2 - noteoffset_px, 140);
    ctx.fillText("4", 2 - noteoffset_px, 180);

    ctx.fillStyle = "rgb(0, 0, 0)";
    for (const noteindex in notes) {
        if (!notes[noteindex].inPlayingNote) {
            notes[noteindex].inPlayingNote = false;
        }
        // 150
        xoffset = notes[noteindex].beat * 60;

        /*if (selectednote == noteindex) {
          ctx.fillStyle = "rgb(0, 50, 255)";
        } else {
          ctx.fillStyle = "rgb(0, 0, 0)";
        }*/
        ctx.beginPath();
        ctx.arc(
            100 + xoffset - noteoffset_px,
            150 + -notes[noteindex].sound * 10,
            10,
            0,
            2 * Math.PI
        );
        ctx.fill();
        ctx.font = "25px Arial";
        ctx.fillText(
            notes[noteindex].accidental.sharpCount,
            75 + xoffset - noteoffset_px,
            160 + -notes[noteindex].sound * 10
        );
        ctx.fillText(
            notes[noteindex].accidental.arrowCount,
            115 + xoffset - noteoffset_px,
            160 + -notes[noteindex].sound * 10
        );
        if (notes[noteindex].sound >= 7 || notes[noteindex].sound <= -5) {
            ctx.strokeStyle = "rgb(0, 0, 0)";
            drawLine(
                ctx,
                85 + xoffset - noteoffset_px,
                150 + -(Math.floor((notes[noteindex].sound - 1) / 2) * 2 + 1) * 10,
                115 + xoffset - noteoffset_px,
                150 + -(Math.floor((notes[noteindex].sound - 1) / 2) * 2 + 1) * 10
            );
        }
        ctx.strokeStyle = "rgba(255, 255, 0, 128)";
        drawLine(ctx,
            100 + xoffset - noteoffset_px,
            150 + -notes[noteindex].sound * 10,
            100 + xoffset - noteoffset_px + notes[noteindex].long*60,
            150 + -notes[noteindex].sound * 10,
    
        )
        ctx.strokeStyle = "rgb(0, 0, 0)";
        if (playing) {
            if (
                !notes[noteindex].inPlayingNote &&
                notes[noteindex].beat <= current_selected_beat
            ) {
                playNoteWithObject(notes[noteindex], mainedo, notes[noteindex].long);
                notes[noteindex].inPlayingNote = true;
            }
        }
    }
    if (current_selected_beat * 60 + 85 + 60 - noteoffset_px > 700) {
        noteoffset_px += 70;
    }
    if (current_selected_beat * 60 + 85 - noteoffset_px < 0) {
        noteoffset_px -= 70;
    }
    ctx.fillStyle = "rgba(0, 50, 255, 25%)";
    ctx.fillRect(current_selected_beat * 60 + 85 - noteoffset_px, 0, 30, 700);
    /*for (let i = 0; i< 10; i++){
      drawLine(ctx, i*40, 100, i*40, 180)
    }*/
    if (playing) {
        current_selected_beat += ((1 / 30) * bpm) / 60;
    }
}
document.addEventListener("DOMContentLoaded", function () {
    window.canvas = document.querySelector("canvas#canvas");
    window.ctx = canvas.getContext("2d");
    setInterval(lifeCycle, 33);
});
beatPlaying = 0;
document.addEventListener("keydown", function (x) {
    //console.log(x.key);
    switch (x.key) {
        case "e":
        case "E":
            if (!playing){
                notes.push(noteObject(-3))
            }

            break;
        case "f":
        case "F":
            if (!playing){
                notes.push(noteObject(-2))
            }

            break;
        case "g":
        case "G":
            if (!playing){
                notes.push(noteObject(-1))
            }

            break;
        case "a":
        case "A":
            if (!playing){
                notes.push(noteObject(0))
            }

            break;
        case "b":
        case "B":
            if (!playing){
                notes.push(noteObject(1))
            }

            break;
        case "c":
        case "C":
            if (!playing){
                notes.push(noteObject(2))
            }

            break;
        case "d":
        case "D":
            if (!playing){
                notes.push(noteObject(3))
            }

            break;
        case "ArrowDown":
            x.preventDefault();
            break;

        case "ArrowRight":
            x.preventDefault();
            if (!playing) current_selected_beat += moveStep;
            break;

        case "ArrowLeft":
            x.preventDefault();
            if (!playing) current_selected_beat -= moveStep;
            break;
        case "ArrowUp":
            x.preventDefault();
            break;
        case "Enter":
            playing = !playing;
            if (playing == false) {
                for (const note of notes) {
                    note.inPlayingNote = false;
                }
                current_selected_beat = 0
            }
    }
});
function toStartPosition() {
    current_selected_beat = 0;
    for (const note of notes) {
        note.inPlayingNote = false;
    }
}