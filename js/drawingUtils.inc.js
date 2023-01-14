/* file: drawingUtils.inc.js 
 * note: should be loaded AFTER main.js
 * */

/* drawingUtils.inc.js defines all of the main utility functions used in the drawing
 * app */

window.PAINT_SETTINGS = window.PAINT_SETTINGS;

/* panic if loaded incorrectly */
if (!window.PAINT_SETTINGS) {
    console.error("drawingUtils.inc.js was loaded incorrectly.  Check index.html.");
    alert("ERROR: FAILED TO LOAD PAINT_SETTINGS. (drawingUtils.inc.js)");
}

/* create a utils namespace (this will hold all of our functions) */
window.utils = { };

/* the "arrows" function syntax is an ES6 feature.  pretty cool. */
window.utils.drawLine = (points) => {
    c.beginPath();
    
    c.lineJoin = "round";
    c.lineCap = "round";
    
    c.moveTo(points.x1, points.y1);
    c.lineTo(points.x2, points.y2);
    
    c.strokeStyle = PAINT_SETTINGS.brushColor;
    c.lineWidth = PAINT_SETTINGS.brushSize;
    
    c.stroke();
}

window.utils.undo = () => {
    if (PAINT_SETTINGS.copyIndex > 0) {
        PAINT_SETTINGS.copyIndex--;
        c.putImageData(PAINT_SETTINGS.canvasCopies[PAINT_SETTINGS.copyIndex], 0, 0);
        /* if they want to redo, they can.  but if they put edits after undoing,
         * it won't work */
        PAINT_SETTINGS.atLatestChange = false;

        utils.updateUndoRedoButtons();
    }
}

window.utils.redo = () => {
    if (!PAINT_SETTINGS.atLatestChange && PAINT_SETTINGS.copyIndex < PAINT_SETTINGS.canvasCopies.length - 1) {
        PAINT_SETTINGS.copyIndex++;
        c.putImageData(PAINT_SETTINGS.canvasCopies[PAINT_SETTINGS.copyIndex], 0, 0);

        utils.updateUndoRedoButtons();
    }
}

window.utils.updateUndoRedoButtons = () => {
    if (!(PAINT_SETTINGS.copyIndex > 0)) {
        $("#undo-button").prop("disabled", true);
        $("#undo-button").removeClass("cursor-pointer");
    } else {
        $("#undo-button").prop("disabled", false);
        $("#undo-button").addClass("cursor-pointer");
    }

    if (!(!PAINT_SETTINGS.atLatestChange && PAINT_SETTINGS.copyIndex < PAINT_SETTINGS.canvasCopies.length - 1)) {
        $("#redo-button").prop("disabled", true);
        $("#redo-button").removeClass("cursor-pointer");
    } else {
        $("#redo-button").prop("disabled", false);
        $("#redo-button").addClass("cursor-pointer");
    }
}

window.utils.trimCanvasCopies = () => {
    if (PAINT_SETTINGS.canvasCopies.length > 50) {
        PAINT_SETTINGS.canvasCopies = PAINT_SETTINGS.canvasCopies.slice(1, PAINT_SETTINGS.canvasCopies.length);
    }
}

window.utils.mouseDownHandler = (event) => {
    /* erasing is just painting but with a fixed white color */
    if (PAINT_SETTINGS.state == "painting" || PAINT_SETTINGS.state == "erasing") {
        PAINT_SETTINGS.paint = true;
        PAINT_SETTINGS.atLatestChange = true;
    
        const offset = $("canvas").offset();
        PAINT_SETTINGS.drawer.x1 = event.pageX - offset.left;
        PAINT_SETTINGS.drawer.y1 = event.pageY - offset.top;
        PAINT_SETTINGS.drawer.x2 = PAINT_SETTINGS.drawer.x1;
        PAINT_SETTINGS.drawer.y2 = PAINT_SETTINGS.drawer.y1;

        /* the user can click and just draw a dot.  they don't have to move their mouse */
        c.beginPath();
        c.arc(PAINT_SETTINGS.drawer.x1, PAINT_SETTINGS.drawer.y1, PAINT_SETTINGS.brushSize / 2, 0, Math.PI * 2, false);
        /* the only difference between erasing and painting in this function is here */
        /* if we aren't painting, but we're still in this conditional block, then we are erasing */
        c.fillStyle = PAINT_SETTINGS.state == "painting" ? PAINT_SETTINGS.brushColor : "#FFFFFF";
        c.fill();
    } else if (PAINT_SETTINGS.state == "filling") {
        PAINT_SETTINGS.fill = true;
        PAINT_SETTINGS.atLatestChange = true;
        /* get the flood fill's image copy set up */
        PAINT_SETTINGS.floodFill.image = c.getImageData(0, 0, canvas.width, canvas.height);

        const offset = $("canvas").offset();
        PAINT_SETTINGS.floodFill.targetColor = utils.getPixelValue(event.pageX - offset.left, event.pageY - offset.top);
        utils.floodFill(event.pageX - offset.left, event.pageY - offset.top);
    }

    utils.updateUndoRedoButtons();
}

window.utils.mouseMoveHandler = (event) => {
    /* erasing = painting with a fixed white color  */
    if (PAINT_SETTINGS.paint && (PAINT_SETTINGS.state == "painting" || PAINT_SETTINGS.state == "erasing")) {
        const offset = $("canvas").offset();
       
        /* here you can see how the previous point is kept and we set the next point
         * to whatever the mousemove event gave us, allowing the the "brush" to 
         * draw a continuous line. */
        PAINT_SETTINGS.drawer.x1 = PAINT_SETTINGS.drawer.x2;
        PAINT_SETTINGS.drawer.y1 = PAINT_SETTINGS.drawer.y2;
        PAINT_SETTINGS.drawer.x2 = event.pageX - offset.left;
        PAINT_SETTINGS.drawer.y2 = event.pageY - offset.top;

        /* again, the only difference between painting and erasing is here */
        if (PAINT_SETTINGS.state == "painting") {
            utils.drawLine(PAINT_SETTINGS.drawer);
        } else { /* only other possibility is that they are erasing */
            PAINT_SETTINGS.brushColor = "#FFFFFF";
            utils.drawLine(PAINT_SETTINGS.drawer);
            PAINT_SETTINGS.brushColor = $("#brush-color-input").val();
        }
    }
}

window.utils.mouseUpHandler = (event) => {
    /* the "if" statement is used to prevent a new copy of the canvas from being
     * created if the user activates the mouseup event by just clicking on the document. */
    if ((PAINT_SETTINGS.paint && (PAINT_SETTINGS.state == "painting" || PAINT_SETTINGS.state == "erasing"))
        || (PAINT_SETTINGS.fill && PAINT_SETTINGS.state == "filling")) {

        /* save a copy of the canvas and set the copyIndex */
        /* erase branches of the history, such that we don't get timeline conflicts when undoing or redoing */
        if (PAINT_SETTINGS.copyIndex != PAINT_SETTINGS.canvasCopies.length - 1) {
            PAINT_SETTINGS.canvasCopies = PAINT_SETTINGS.canvasCopies.slice(0, PAINT_SETTINGS.copyIndex + 1);
        }
        PAINT_SETTINGS.canvasCopies.push(c.getImageData(0, 0, canvas.width, canvas.height));
        utils.trimCanvasCopies();
        PAINT_SETTINGS.copyIndex = PAINT_SETTINGS.canvasCopies.length - 1;
    }
    PAINT_SETTINGS.paint = false;
    PAINT_SETTINGS.fill = false;

    utils.updateUndoRedoButtons();
}

window.utils.convertTouchToMouse = (event, mouseEventHandler) => {
    /* prevent default touch scrolling / reloading */
    event.preventDefault();
    /* from MDN web docs.  you need both the .touches[0] or the changedTouches[0], as some
     * touch events used .changedTouches (very annoying) */
    const touch = event.originalEvent.touches[0] || event.originalEvent.changedTouches[0];

    /* it's not actually a mouse event, but it has the only properties needed
     * (constructing a new MouseEvent() object every time this function is run
     * would just be a waste of compute time) */
    /* NOTE: you need to round touch.pageX/Y values (they aren't integers by
     * default for some odd reason) */
    const fakeMouseEvent = { pageX : Math.floor(touch.pageX), pageY : Math.floor(touch.pageY) };

    mouseEventHandler(fakeMouseEvent);
}

window.utils.resetCanvasCopies = () => {
    /* reset canvas copies */
    PAINT_SETTINGS.canvasCopies = [c.getImageData(0, 0, canvas.width, canvas.height)];
    PAINT_SETTINGS.copyIndex = 0;
    utils.updateUndoRedoButtons();
}

/* best resource on understanding canvas pixel manipulation (MDN):
 * https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas */
window.utils.getPixelValue = (x, y) => {
    /* translate from 2d coordinates to the 1d index */
    const red = y * (PAINT_SETTINGS.floodFill.image.width * 4) + x * 4;
    return ((PAINT_SETTINGS.floodFill.image.data[red]     << 16) |
            (PAINT_SETTINGS.floodFill.image.data[red + 1] << 8 ) |
            (PAINT_SETTINGS.floodFill.image.data[red + 2] << 0 ));
}

window.utils.setPixelValue = (x, y, value) => {
    const red = y * (PAINT_SETTINGS.floodFill.image.width * 4) + x * 4;
    PAINT_SETTINGS.floodFill.image.data[red]     = value >>> 16;
    PAINT_SETTINGS.floodFill.image.data[red + 1] = (value >>> 8) & 0x0000FF;
    PAINT_SETTINGS.floodFill.image.data[red + 2] = (value >>> 0) & 0x0000FF;
    PAINT_SETTINGS.floodFill.image.data[red + 3] = 255;
}

window.utils.inside = (x, y) => {
    return (utils.getPixelValue(x, y) === PAINT_SETTINGS.floodFill.targetColor);
}

/* stack based four-way iterative method (based on the four-way recursive 
 * method).  this implementation uses breadth first search */
/* NOTE: PAINT_SETTINGS.floodFill.image should already have been set up by the
 * mouseDownHandler prior to calling utils.floodFill */
window.utils.floodFill = (x, y) => {
    /* we don't want an infinite loop */
    if (PAINT_SETTINGS.floodFill.targetColor === PAINT_SETTINGS.floodFill.replacementColor) return;

    if (!utils.inside(x, y)) return;

    let pixelQueue = [{ x: x, y: y }];

    while (pixelQueue.length > 0) {
        const p = pixelQueue.pop();

        /* don't add if they hit a wall, etc. */
        if (p.x < 0 || p.x >= canvas.width || p.y < 0 || p.y >= canvas.height || !utils.inside(p.x, p.y)) {
            continue;
        } else {
            utils.setPixelValue(p.x, p.y, PAINT_SETTINGS.floodFill.replacementColor);
            pixelQueue.push({ x: p.x,     y: p.y + 1 }); // NORTH
            pixelQueue.push({ x: p.x,     y: p.y - 1 }); // SOUTH
            pixelQueue.push({ x: p.x + 1, y: p.y });     // EAST
            pixelQueue.push({ x: p.x - 1, y: p.y });     // WEST
        }
    }

    c.putImageData(PAINT_SETTINGS.floodFill.image, 0, 0);
}

window.utils.updateButtons = () => {
    $(".mode-button").removeClass("selected");
    switch (PAINT_SETTINGS.state) {
        case "painting":
            $("#brush-button").addClass("selected");
            break;
        case "filling":
            $("#fill-button").addClass("selected");
            break;
        case "erasing":
            $("#erase-button").addClass("selected");
            break;
        case "none":
            break;
        default:
            break;
    }
}
