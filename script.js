// @ts-check

class WebGL2Wrapper {
    /** @type {WebGL2RenderingContext } */
    #context;

    /** @type {WebGLShader | null} */
    #vertexShader = null;

    /** @type {WebGLShader | null} */
    #fragmentShader = null;

    /** @type {WebGLUniformLocation | null} */
    #uTimeLocation = null;

    /** @type {WebGLUniformLocation | null} */
    #uResolutionLocation = null;

    /** @type {WebGLProgram | null} */
    #program = null;

    /** @type {((message: string) => void) | null} */
    #onInfo = null;

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {(message: string) => void} [onInfo]
     */
    constructor(canvas, onInfo) {
        const gl = canvas.getContext("webgl2");
        if (!gl) throw new Error("WebGL2 not supported");
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, Float32Array.of(-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1), gl.STATIC_DRAW);
        gl.clearColor(0, 0, 0, 1);
        this.#context = gl;
        if (typeof onInfo === "function") this.#onInfo = onInfo;
    }

    /**
     * @param {string} shaderSource
     */
    createVertexShader(shaderSource) {
        const gl = this.#context;
        const oldShader = this.#vertexShader;
        this.#vertexShader = this.#createShader(gl.VERTEX_SHADER, shaderSource);
        if (oldShader) gl.deleteShader(oldShader);
    }

    /**
     * @param {string} shaderSource
     */
    createFragmentShader(shaderSource) {
        const gl = this.#context;
        const oldShader = this.#fragmentShader;
        this.#fragmentShader = this.#createShader(gl.FRAGMENT_SHADER, shaderSource);
        if (oldShader) gl.deleteShader(oldShader);
    }

    /**
     * @param {GLenum} type
     * @param {string} source
     */
    #createShader(type, source) {
        const gl = this.#context;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (success) return shader;
        const errorLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        try {
            this.#onInfo(errorLog);
        } catch(e) {
            console.error(e);
        }
        throw new Error(errorLog);
    }

    #createProgram() {
        const gl = this.#context;
        const program = gl.createProgram();
        gl.attachShader(program, this.#vertexShader);
        gl.attachShader(program, this.#fragmentShader);
        gl.linkProgram(program);
        const success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (success) return program;
        const errorLog = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        try {
            this.#onInfo(errorLog);
        } catch(e) {
            console.error(e);
        }
        throw new Error(errorLog);
    }

    compileProgram() {
        const program = this.#createProgram();
        const gl = this.#context;
        gl.useProgram(program);
        const positionLocation = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        this.#uTimeLocation = gl.getUniformLocation(program, "t");
        this.#uResolutionLocation = gl.getUniformLocation(program, "r");
        this.#program = program;
    }

    /**
     * @param {GLfloat} time
     * @param {GLfloat} width
     * @param {GLfloat} height
     */
    draw(time, width, height) {
        if (!this.#program) throw new Error("no program found");
        const gl = this.#context;
        gl.uniform1f(this.#uTimeLocation, time);
        gl.uniform2f(this.#uResolutionLocation, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * @param {GLsizei} width
     * @param {GLsizei} height
     */
    setViewportSize(width, height) {
        const gl = this.#context;
        gl.viewport(0, 0, width, height);
    }
}

~function() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById("webgl-canvas");

    /** @type {HTMLTextAreaElement} */
    const fsSource = document.getElementById("webgl-fragment-shader");

    /** @type {HTMLDivElement} */
    const fsDisplay = document.getElementById("fragment-shader-display");

    /** @type {HTMLDivElement} */
    const glLog = document.getElementById("webgl-log");

    const gl = new WebGL2Wrapper(canvas, s => {
        glLog.textContent += s;
    });

    const resizeToHalfWindow = () => {
        const rc = canvas.getBoundingClientRect();
        canvas.width = rc.width;
        canvas.height = rc.height;
        gl.setViewportSize(canvas.width, canvas.height);
    };
    window.addEventListener("resize", resizeToHalfWindow);
    resizeToHalfWindow();

    gl.createVertexShader("precision mediump float;attribute vec2 position;void main(void){gl_Position=vec4(position,0.0,1.0);}");

    function compileAndDraw() {
        gl.createFragmentShader(fsSource.value);
        gl.compileProgram();

        const ctrler = new AbortController();
        const { signal } = ctrler;

        const loop = async () => {
            while (!signal.aborted) {
                const now = await new Promise(r => requestAnimationFrame(r));
                gl.draw(now / 1000, canvas.width, canvas.height);
            }
        };
        loop();

        return ctrler;
    }

    /**
     * @type {{ regexGen(): RegExp, stylize(style: CSSStyleDeclaration): void }[]}
     */
    const stylizer = [{
        regexGen: () => /^\/\/[^\n\r]*/v,
        stylize(style) {
            style.color = "#6A9955";
        },
    }, {
        regexGen: () => /^\/\*[\S\s]*?\*\//v,
        stylize(style) {
            style.color = "#6A9955";
        },
    }, {
        regexGen: () => /^[\x09\x0A\x0B\x0C\x0D\x20]+/v,
        stylize(_style) {
        },
    }, {
        regexGen: () => /^\b(?:precision|invariant|continue|centroid|mediump|discard|default|uniform|mat4x4|mat4x3|mat4x2|mat3x4|mat3x3|mat3x2|mat2x4|mat2x3|mat2x2|return|switch|smooth|layout|highp|uvec4|uvec3|uvec2|bvec4|bvec3|bvec2|ivec4|ivec3|ivec2|false|float|inout|while|break|const|lowp|uint|vec4|vec3|vec2|mat4|mat3|mat2|true|bool|void|else|case|flat|int|out|for|in|if|do)\b/v,
        stylize(style) {
            style.color = "#569CD6";
        },
    }, {
        regexGen: () => /^[A-Za-z_][A-Za-z\d_]*(?=[\x09\x0A\x0B\x0C\x0D\x20]*\()/v,
        stylize(style) {
            style.color = "#DCDCAA";
        },
    }, {
        regexGen: () => /^[A-Za-z_][A-Za-z\d_]*/v,
        stylize(style) {
            style.color = "#9CDCFE";
        },
    }, {
        regexGen: () => /^(?:0[xX][\dA-Fa-f]+[uU]?|\d+[eE][+\-]?\d+[fF]?|(?:\d+\.\d*|\.\d+)(?:[eE][+\-]?\d+)?[fF]?|[1-9]\d*[uU]?|0[0-7]*[uU]?)/v,
        stylize(style) {
            style.color = "#B5CEA8";
        },
    }, {
        regexGen: () => /^[.+\-\/*%\<\>^\|\&~=!:;,?]/v,
        stylize(style) {
            style.color = "#CCCCCC";
        },
    }, {
        regexGen: () => /^[\)\}\]]/v,
        stylize(style) {
            if (0 < parenthMode) parenthMode--;
            else parenthMode = 3 - 1;
            style.color = ["#FFD700", "#DA70D6", "#179FFF"][parenthMode];
        },
    }, {
        regexGen: () => /^[\(\{\[]/v,
        stylize(style) {
            style.color = ["#FFD700", "#DA70D6", "#179FFF"][parenthMode];
            parenthMode++;
            parenthMode %= 3;
        },
    }];
    let parenthMode = 0;
    function updateFsDisplay() {
        let t = fsSource.value;
        fsDisplay.textContent = "";
        parenthMode = 0;
        outer: while (t) {
            for (const s of stylizer) {
                const m = s.regexGen().exec(t)?.[0];
                if (m) {
                    const span = document.createElement("span");
                    span.textContent = m;
                    s.stylize(span.style);
                    fsDisplay.appendChild(span);
                    t = t.slice(m.length, t.length);
                    continue outer;
                }
            }
            const m = t[Symbol.iterator]().next().value;
            if (m) {
                const span = document.createElement("span");
                span.dataset.tokenKind = "invalid-char";
                span.textContent = m;
                span.style.color = "#CCCCCC";
                span.style.backgroundColor = "#631616";
                fsDisplay.appendChild(span);
                t = t.slice(m.length, t.length);
                continue;
            } else {
                break;
            }
        }
    }

    updateFsDisplay();

    let abortCtrler = compileAndDraw();
    /**
     * @type {number | null}
     */
    let prevTimerId = null;
    fsSource.addEventListener("input", () => {
        updateFsDisplay();
        if (prevTimerId) clearTimeout(prevTimerId);
        prevTimerId = setTimeout(() => {
            abortCtrler.abort();
            abortCtrler = compileAndDraw();
        }, 1000);
    });
    fsDisplay.scrollTo(fsSource.scrollLeft, fsSource.scrollTop);
    fsSource.addEventListener("scroll", () => {
        fsDisplay.scrollTo(fsSource.scrollLeft, fsSource.scrollTop);
    });
    // fsSource.addEventListener("keydown", e => {
    //     if (e.key === "z" && e.altKey) {
    //         e.preventDefault();
    //         fsDisplay.style.whiteSpace = fsSource.style.whiteSpace = fsSource.style.whiteSpace === "pre" ? "pre-wrap" : "pre";
    //     }
    // });
}();
