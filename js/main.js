/* file: main.js 
 * note: should be loaded BEFORE any utility files load
 * */

const canvas = document.querySelector("#canvas");
/* the willReadFrequently option will optimize the canvas for hardward accelerated
 * graphics cards.  it makes directly reading and writing to the canvas much quicker */
const c      = canvas.getContext("2d", { willReadFrequently: true, imageSmoothingEnabled: false });

/* account for the tool bar in the canvas dimensions */
canvas.width  = window.innerWidth - 2 - 20;
canvas.height = window.innerHeight - 70 - 2 - 20;
$("#canvas.holder").css({ "width": canvas.width, "height": canvas.height });

/* make sure that the canvas is initialized to all white pixels */
c.fillStyle = "#FFFFFF";
c.fillRect(0, 0, canvas.width, canvas.height);

/* global object which keeps track of the entire state of the program */
/* PAINT_SETTINGS is basically "exported" as a global object */
window.PAINT_SETTINGS = {
    brushSize: 9, /* diameter of the brush, not radius */
    brushColor: "#000000",
    paint: false, /* tells the even if they should be drawing or not (some of these
                   * events, such as the onmousemove event, can be triggered even
                   * when the user isn't drawing */
    fill: false,
    /* holds the previous point that you drew with, the "brush" actually makes a bunch of
     * small lines, so that the line you draw is always continuous (otherwise, if you
     * moved your pointer to fast, it would show up as a bunch of dots */
    drawer: {
        x1: undefined,
        y1: undefined,
        x2: undefined,
        y2: undefined
    },

    /* holds each raw image data blob of the canvas.  used for undo and
     * redo actions */
    canvasCopies: [c.getImageData(0, 0, canvas.width, canvas.height)],
    copyIndex: 0,
    atLatestChange: true, /* if someone wants to redo an action AFTER they undid something
                           * AND THEN made edits, there will be a timeline conflict.  this
                           * acts as a kill switch set to true whenever you make an edit */
    /* floodFill settings */
    floodFill: {
        image: undefined,
        targetColor: 0xFFFFFF,
        replacementColor: 0x000000
    },

    /* possible states: "filling", "painting", "none" */
    state: "painting",

    defaultCanvasWidth: canvas.width,
    defaultCanvasHeight: canvas.height    
};

/* run after full loading of all files */
$(document).ready(() => {
    /* run a CSS media query to check if the user is mobile */
    window.isMobile = window.matchMedia("only screen and (max-width: 600px)").matches;

    utils.updateUndoRedoButtons();

    /* update canvas dimension UI */
    $("#dimension-x").val(PAINT_SETTINGS.defaultCanvasWidth);
    $("#dimension-y").val(PAINT_SETTINGS.defaultCanvasHeight);

    $("#reset-dimensions-button").on("click", (event) => {
        event.preventDefault();

        if (confirm("This action will erase the canvas.  Do you wish to proceed?")) {
            canvas.width = PAINT_SETTINGS.defaultCanvasWidth;
            canvas.height = PAINT_SETTINGS.defaultCanvasHeight;

            $("#dimension-x").val(PAINT_SETTINGS.defaultCanvasWidth);
            $("#dimension-y").val(PAINT_SETTINGS.defaultCanvasHeight);

            utils.resetCanvasCopies();
        }
    });

    $("#dimension-x").on("change", () => {
        if (confirm("This action will erase the canvas.  Do you wish to proceed?")) {
            canvas.width = $("#dimension-x").val();
            utils.resetCanvasCopies();
        }
    });

    $("#dimension-y").on("change", () => {
        if (confirm("This action will erase the canvas.  Do you wish to proceed?")) {
            canvas.height = $("#dimension-y").val();
            utils.resetCanvasCopies();
        }
    });

    /* update UI and PAINT_SETTINGS */
    $("#brush-button").on("click", (event) => {
        event.preventDefault();

        if (PAINT_SETTINGS.state != "painting") {
            PAINT_SETTINGS.state = "painting";
        } else if (PAINT_SETTINGS.state == "painting") {
            PAINT_SETTINGS.state = "none";
        }

        utils.updateButtons();
    });

    $("#fill-button").on("click", (event) => {
        event.preventDefault();

        if (PAINT_SETTINGS.state != "filling") {
            PAINT_SETTINGS.state = "filling";
        } else if (PAINT_SETTINGS.state == "filling") {
            PAINT_SETTINGS.state = "none";
        }

        utils.updateButtons();
    });

    $("#erase-button").on("click", (event) => {
        event.preventDefault();

        if (PAINT_SETTINGS.state != "erasing") {
            PAINT_SETTINGS.state = "erasing";
        } else if (PAINT_SETTINGS.state == "erasing") {
            PAINT_SETTINGS.state = "none";
        }

        utils.updateButtons();
    });

    $("#clear-button").on("click", (event) => {
        event.preventDefault();

        if (confirm("Are you sure you want to clear the canvas?")) {
            c.fillStyle = "#FFFFFF";
            c.fillRect(0, 0, canvas.width, canvas.height);

            utils.resetCanvasCopies();
        }
    });

    $("#brush-size-input").on("input", () => {
        const sliderValue = $("#brush-size-input").val();
        $("#brush-size-display").css({
            "min-width": `${sliderValue}px`,
            "min-height": `${sliderValue}px`,
            "margin-left": `${(49 - sliderValue) / 2}px`,
            "margin-right": `${(49 - sliderValue) / 2}px`
        });
        PAINT_SETTINGS.brushSize = sliderValue;
    });

    /* set the brush color and the replacement color */
    $("#brush-color-input").change(() => {
        PAINT_SETTINGS.brushColor = $("#brush-color-input").val();
        PAINT_SETTINGS.floodFill.replacementColor = parseInt(PAINT_SETTINGS.brushColor.slice(1, PAINT_SETTINGS.brushColor.length), 16);
    });

    /* import file functions */
    $("#image-import-button").on("click", (event) => {

        if (confirm("Are you sure you want to import this image?")) {
            const files = document.querySelector("#image-import").files;

            if (files.length == 1) {
                const file = files[0];
            
                /* create a dummy image element and use that with c.drawImage() */
                const imagePath = URL.createObjectURL(file);

                const tempImage = document.createElement("img");
                document.body.appendChild(tempImage);
                tempImage.setAttribute("style", "display: none;");
                tempImage.src = imagePath;

                /* we have to wait for the image to load first, otherwise it will just be null */
                tempImage.onload = () => {
                    c.drawImage(tempImage, 0, 0, tempImage.width, tempImage.height);

                    /* no need for the object URL now */
                    URL.revokeObjectURL(imagePath);

                    /* also no need for the dummy image element */
                    tempImage.parentNode.removeChild(tempImage);
                }

                /* c.drawImage needs time to run */
                setTimeout(utils.resetCanvasCopies, 500);
            } else {
                alert("An image must be selected.");
            }
        }
    });

    /* download button */
    $("#download-button").on("click", (event) => {
        event.preventDefault();

        const canvasDataURL = canvas.toDataURL(); /* data:image/png;base64, ... */

        const tempLink = document.createElement("a");
        tempLink.href = canvasDataURL; /* set the link to the canvas data */
        tempLink.download = "elcoPainting.png"; /* set the download filename
                                                 * (and make the link "downloadable") */
        document.body.appendChild(tempLink);

        /* trigger a click on the link to make the browser download the image */
        tempLink.click();

        /* remove the link from the document */
        tempLink.parentNode.removeChild(tempLink);
    });

    /* undo / redo actions (using jQuery Hotkeys and the UI buttons) */
    $(document).bind("keydown", "alt+u", () => {
        utils.undo();
    });

    $(document).bind("keydown", "alt+r", () => {
        utils.redo();
    });

    $("#undo-button").on("click", (event) => {
        event.preventDefault();

        utils.undo();
    });

    $("#redo-button").on("click", (event) => {
        event.preventDefault();

        utils.redo();
    });

    $("canvas").on("mousedown", utils.mouseDownHandler);
    $("canvas").on("mousemove", utils.mouseMoveHandler);
    /* uses the document instead of the canvas because the user's mouse could leave
     * the canvas and then could trigger mouse up event.  then the next time their mouse
     * moved over the canvas, we would start drawing, which is unwanted behavior */
    $(document).on("mouseup", utils.mouseUpHandler);

    /* add the same events for mobile */
    $("canvas").on("touchstart", (event) => {
        utils.convertTouchToMouse(event, utils.mouseDownHandler);
    });

    $("canvas").on("touchmove", (event) => {
        utils.convertTouchToMouse(event, utils.mouseMoveHandler);
    });

    $("canvas").on("touchend", (event) => {
        utils.convertTouchToMouse(event, utils.mouseUpHandler);
    });
});
