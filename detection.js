
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
    // maintain_aspect_ratio_resize(final, final, 750)
    return final
}


async function load_database(db_filename) {
    const response = await fetch(db_filename);

    return response.arrayBuffer()
}


function get_prices_for_uuid(db, uuid) {
    var res = []
    db.each("SELECT price, type FROM prices where uuid=$uuid", { $uuid: uuid }, function (row) {
        res.push(row)
    }, function () { console.log(res) });
    return res
}


async function initialize_tesseract() {
    const worker = Tesseract.createWorker({
        // workerPath: './Tesseract/worker.min.js',
        langPath: './Tesseract/Lang/',
        corePath: './Tesseract/tesseract-core.wasm.js',
        logger: m => m
    });
    Tesseract.setLogging(false);
    await init();

    async function init() {
        await worker.load()
        await worker.loadLanguage('fra+eng')
        await worker.initialize('fra+eng')
        await worker.setParameters({
            tessedit_char_blacklist: '=<>#!;?[]“\"‘¢ï»~{}’ë¥ä®_&@²$/£*µ§:\\_|',
            tessedit_user_defined_dpi: '70'
        });
    }
    return worker
}

async function OCR(tess_worker, image) {
    var res = {};
    await work()

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

function levenshtein(s, t) {
    if (s === t) {
        return 0;
    }
    var n = s.length, m = t.length;
    if (n === 0 || m === 0) {
        return n + m;
    }
    var x = 0, y, a, b, c, d, g, h, k;
    var p = new Array(n);
    for (y = 0; y < n;) {
        p[y] = ++y;
    }

    for (; (x + 3) < m; x += 4) {
        var e1 = t.charCodeAt(x);
        var e2 = t.charCodeAt(x + 1);
        var e3 = t.charCodeAt(x + 2);
        var e4 = t.charCodeAt(x + 3);
        c = x;
        b = x + 1;
        d = x + 2;
        g = x + 3;
        h = x + 4;
        for (y = 0; y < n; y++) {
            k = s.charCodeAt(y);
            a = p[y];
            if (a < c || b < c) {
                c = (a > b ? b + 1 : a + 1);
            }
            else {
                if (e1 !== k) {
                    c++;
                }
            }

            if (c < b || d < b) {
                b = (c > d ? d + 1 : c + 1);
            }
            else {
                if (e2 !== k) {
                    b++;
                }
            }

            if (b < d || g < d) {
                d = (b > g ? g + 1 : b + 1);
            }
            else {
                if (e3 !== k) {
                    d++;
                }
            }

            if (d < g || h < g) {
                g = (d > h ? h + 1 : d + 1);
            }
            else {
                if (e4 !== k) {
                    g++;
                }
            }
            p[y] = h = g;
            g = d;
            d = b;
            b = c;
            c = a;
        }
    }

    for (; x < m;) {
        var e = t.charCodeAt(x);
        c = x;
        d = ++x;
        for (y = 0; y < n; y++) {
            a = p[y];
            if (a < c || d < c) {
                d = (a > d ? d + 1 : a + 1);
            }
            else {
                if (e !== s.charCodeAt(y)) {
                    d = c + 1;
                }
                else {
                    d = c;
                }
            }
            p[y] = d;
            c = a;
        }
        h = d;
    }

    return h;
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