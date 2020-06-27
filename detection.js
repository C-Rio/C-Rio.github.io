let imgElement = document.getElementById('imageSrc')
let inputElement = document.getElementById('fileInput')
let dbFileElm = document.getElementById('dbfile')


inputElement.addEventListener('change', (e) => { imgElement.src = URL.createObjectURL(e.target.files[0]); }, false)


function crop_image_border(mat) {
    // let mat = cv.imread(imgElement)
    maintain_aspect_ratio_resize(mat, mat, width = 750)

    let mat_gray = new cv.Mat();
    cv.cvtColor(mat, mat_gray, cv.COLOR_RGBA2GRAY, 0);

    cv.medianBlur(mat_gray, mat_gray, 15)

    let img_h = mat_gray.rows
    let img_w = mat_gray.cols

    let margin_x = Math.floor(img_w * 0.01)
    let margin_y = Math.floor(img_h * 0.01)

    cv.adaptiveThreshold(mat_gray, mat_gray, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2)

    cv.bitwise_not(mat_gray, mat_gray)

    let lines = new cv.Mat()
    cv.HoughLinesP(mat_gray, lines, 1, Math.PI / 180, 250, 50, 20)


    // If no lines have been found, display original image
    if (lines.rows == 0) {
        // cv.imshow('canvasOutput', mat)
        return mat
    }

    let filtered_line = []

    for (let i = 0; i < lines.rows; ++i) {
        let startPoint = new cv.Point(lines.data32S[i * 4], lines.data32S[i * 4 + 1])
        let endPoint = new cv.Point(lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3])

        if (is_line_outside_margin(startPoint, endPoint, margin_x, margin_y, img_w, img_h))
            filtered_line.push(lines.data32S[i * 4], lines.data32S[i * 4 + 1], lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3])

    }

    // If almost all lines have been filtered, display original image
    if (filtered_line.length < 8) {
        console.log("Filtered line < 8")
        // cv.imshow('canvasOutput', mat)
        return mat;
    }

    let mat2 = cv.matFromArray(filtered_line.length / 2, 2, cv.CV_32S, filtered_line);
    var hull = new cv.Mat()
    cv.convexHull(mat2, hull, false, true)

    let rect = cv.boundingRect(hull)
    let rect2 = new cv.Rect(rect.x, rect.y, rect.width, rect.height)
    var final = mat.roi(rect2)
    maintain_aspect_ratio_resize(final, final, 750)
    return final
}

document.getElementById('downloadButton').onclick = function () {
    this.href = document.getElementById("canvasOutput").toDataURL();
    this.download = "image.png";
};


inputElement.addEventListener('change', (e) => { imgElement.src = URL.createObjectURL(e.target.files[0]); }, false)



dbFileElm.addEventListener('change', (e) => {
    console.log("OK")
    config = {
        locateFile: filename => `./Sql.js/${filename}`
    }

    initSqlJs(config).then(function (SQL) {
        var f = e.target.files[0];
        var r = new FileReader();
        r.readAsArrayBuffer(f);

        r.onload = function () {
            var Uints = new Uint8Array(r.result);
            db = new SQL.Database(Uints);

            var st = "(Mana Drain U, .Instant ) - i Counter target spell.At the beginning of your next main phase, add an.amount of  to your mana pool equal to that spells converted mana cost.M / Enthusiasm is no match for preparation.ä UR d CQ SWANLAND"


            // English request
            // var res = db.exec("SELECT name, Text, flavorText, type, uuid FROM cards");
            let min_dist = 99999999
            let min_uuid = null

            db.each("SELECT name, Text, flavorText, type, uuid FROM cards", function (row) {
                var dt = levenshtein(st, row.name + row.type + row.Text + row.flavorText)
                if (dt < min_dist) {
                    min_dist = dt
                    min_uuid = row.uuid
                }

            }, function () {
                console.log("min_uuid =", min_uuid)
                get_prices_for_uuid(db, min_uuid)
                console.log("FIN")
            });
        }
    });
}, false)


async function load_database(db_filename) {
    const response = await fetch(db_filename);

    return response.arrayBuffer()
}


// function load_database(db_filename) {
//     var db_tmp;
//     fetch(db_filename)
//         .then(response => response.arrayBuffer())
//         .then(data => db_tmp = data)
//         .then(() => console.log(db_tmp))
//     console.log(db_tmp)
//     return db_tmp
// }



function get_prices_for_uuid(db, uuid) {
    var res = []
    db.each("SELECT price, type FROM prices where uuid=$uuid", { $uuid: uuid }, function (row) {
        res.push(row)
    }, function () { console.log(res) });
}


async function initialize_tesseract() {
    const worker = Tesseract.createWorker({
        workerPath: './Tesseract/worker.min.js',
        langPath: './Tesseract/Lang/',
        corePath: './Tesseract/tesseract-core.wasm.js',
        logger: m => console.log(m)
    });
    Tesseract.setLogging(false);
    await init();

    async function init() {
        await worker.load()
        await worker.loadLanguage('fra+eng')
        await worker.initialize('fra+eng')
        await worker.setParameters({
            tessedit_char_blacklist: '=<>#!;?[]“\"‘¢ï»~{}’ë¥ä_&@²$/£*µ§:\\_|'
        });
    }
    return worker
}

async function OCR(tess_worker, image) {
    await work()
    var res = {};

    async function work() {

        let result = await tess_worker.detect(image)
        console.log(result.data)

        result = await tess_worker.recognize(image)
        var lines = result.data.text.split("\n")

        var filtered = lines.filter(non_phrasal)
        console.log(filtered)

        var final = filtered.join(' ')
        console.log(final)
        res.text = final

        var lang = franc(final)
        console.log(lang)
        res.lang = lang

        await tess_worker.terminate();
    }
    return res
}

imgElement.onload = function () {
    let cont_img = crop_image_border(imgElement)
    cv.imshow('canvasOutput', cont_img)

    const exampleImage = document.getElementById('canvasOutput')

    const worker = Tesseract.createWorker({
        workerPath: './Tesseract/worker.min.js',
        langPath: './Tesseract/Lang/',
        corePath: './Tesseract/tesseract-core.wasm.js',
        logger: m => console.log(m)
    });
    Tesseract.setLogging(false);
    work();

    async function work() {
        await worker.load()
        await worker.loadLanguage('fra+eng')
        await worker.initialize('fra+eng')
        await worker.setParameters({
            tessedit_char_blacklist: '=<>#!;?[]“\"‘¢ï»~{}’ë¥ä_&@²$/£*µ§:\\_|'
        });

        let result = await worker.detect(exampleImage)
        console.log(result.data)

        result = await worker.recognize(exampleImage)
        var lines = result.data.text.split("\n")

        var filtered = lines.filter(non_phrasal)
        console.log(filtered)

        var final = filtered.join(' ')
        console.log(final)

        var lang = franc(final)
        console.log(lang)

        await worker.terminate();
    }
};

function levenshtein(a, b) {
    var tmp;
    if (a.length === 0) { return b.length; }
    if (b.length === 0) { return a.length; }
    if (a.length > b.length) { tmp = a; a = b; b = tmp; }

    var i, j, res, alen = a.length, blen = b.length, row = Array(alen);
    for (i = 0; i <= alen; i++) { row[i] = i; }

    for (i = 1; i <= blen; i++) {
        res = i;
        for (j = 1; j <= alen; j++) {
            tmp = row[j - 1];
            row[j - 1] = res;
            res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1, Math.min(res + 1, row[j] + 1));
        }
    }
    return res;
}

function non_phrasal(line) {
    if (line.length <= 2)
        return false

    var num_non_special = line.replace(/[^A-Za-z]/g, '').length

    if (num_non_special < 0.5 * line.length)
        return false

    var splitted = line.split(' ')
    return !splitted.every(is_word_very_short)
}

function is_word_very_short(line) {
    return line.length <= 2
}

function maintain_aspect_ratio_resize(image, dst, width = null) {

    // Grab the image size and initialize dimensions
    let dim = null;
    let h = image.rows;
    let w = image.cols;


    // Return original image if no need to resize
    if (width === null)
        return image;


    //  Calculate the ratio of the width and construct the dimensions
    let r = width / w;
    dim = new cv.Size(width, Math.floor(h * r));

    if (r > 1)
        inter = cv.INTER_LANCZOS4
    else
        inter = cv.INTER_AREA


    // Resize the image
    cv.resize(image, dst, dim, 0, 0, inter);
}

function is_line_outside_margin(point1, point2, margin_x, margin_y, img_w, img_h) {

    if (point1.x < margin_x || point2.x < margin_x || point1.y < margin_y || point2.y < margin_y || point1.x > img_w - margin_x || point2.x > img_w - margin_x || point1.y > img_h - margin_y || point2.y > img_h - margin_y)
        return false;

    else
        return true;
}