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
            this.#onInfo(errorLog ?? "An error occurred\n");
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
            this.#onInfo(errorLog ?? "An error occurred\n");
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

function main() {
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

    function resizeToHalfWindow() {
        const rc = canvas.getBoundingClientRect();
        canvas.width = rc.width;
        canvas.height = rc.height;
        gl.setViewportSize(canvas.width, canvas.height);
    }
    window.addEventListener("resize", resizeToHalfWindow);
    resizeToHalfWindow();

    gl.createVertexShader("precision mediump float;attribute vec2 position;void main(void){gl_Position=vec4(position,0.0,1.0);}");

    function compileAndDraw() {
        glLog.textContent = "";
        gl.createFragmentShader(fsSource.value);
        gl.compileProgram();

        const ctrler = new AbortController();
        const { signal } = ctrler;

        async function loop() {
            while (!signal.aborted) {
                const now = await new Promise(r => requestAnimationFrame(r));
                gl.draw(now / 1000, canvas.width, canvas.height);
            }
        }
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
        regexGen: () => /^\b(?:samplerCubeArrayShadow|sampler1DArrayShadow|sampler2DArrayShadow|sampler2DRectShadow|isampler2DMSArray|usampler2DMSArray|samplerCubeShadow|isamplerCubeArray|usamplerCubeArray|sampler2DMSArray|samplerCubeArray|sampler1DShadow|isampler1DArray|usampler1DArray|sampler2DShadow|isampler2DArray|usampler2DArray|iimage2DMSArray|uimage2DMSArray|iimageCubeArray|uimageCubeArray|sampler1DArray|sampler2DArray|isampler2DRect|usampler2DRect|isamplerBuffer|usamplerBuffer|image2DMSArray|imageCubeArray|noperspective|sampler2DRect|samplerBuffer|iimage1DArray|uimage1DArray|iimage2DArray|uimage2DArray|sampler3DRect|isampler2DMS|usampler2DMS|isamplerCube|usamplerCube|image1DArray|image2DArray|iimage2DRect|uimage2DRect|iimageBuffer|uimageBuffer|atomic_uint|sampler2DMS|samplerCube|image2DRect|imageBuffer|subroutine|isampler1D|usampler1D|isampler2D|usampler2D|isampler3D|usampler3D|iimage2DMS|uimage2DMS|iimageCube|uimageCube|attribute|writeonly|invariant|precision|sampler1D|sampler2D|sampler3D|image2DMS|imageCube|partition|interface|namespace|coherent|volatile|restrict|readonly|centroid|continue|iimage1D|uimage1D|iimage2D|uimage2D|iimage3D|uimage3D|template|resource|noinline|external|unsigned|uniform|varying|precise|default|discard|dmat2x2|dmat2x3|dmat2x4|dmat3x2|dmat3x3|dmat3x4|dmat4x2|dmat4x3|dmat4x4|mediump|image1D|image2D|image3D|typedef|buffer|shared|layout|smooth|sample|switch|double|return|mat2x2|mat2x3|mat2x4|mat3x2|mat3x3|mat3x4|mat4x2|mat4x3|mat4x4|struct|common|active|inline|public|static|extern|superp|output|filter|sizeof|const|patch|break|while|inout|false|float|ivec2|ivec3|ivec4|bvec2|bvec3|bvec4|uvec2|uvec3|uvec4|dvec2|dvec3|dvec4|dmat2|dmat3|dmat4|highp|class|union|short|fixed|input|hvec2|hvec3|hvec4|fvec2|fvec3|fvec4|using|flat|case|else|void|bool|true|vec2|vec3|vec4|uint|mat2|mat3|mat4|lowp|enum|this|goto|long|half|cast|for|out|int|asm|do|if|in)\b/v,
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
        const nbspSpan = document.createElement("span");
        nbspSpan.textContent = "\u200b";
        fsDisplay.appendChild(nbspSpan);
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
        const span = document.createElement("span");
        span.textContent = "\u200b";
        fsDisplay.appendChild(span);
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
    const syncScroll = () => void fsDisplay.scrollTo(fsSource.scrollLeft, fsSource.scrollTop);
    fsSource.addEventListener("scroll", syncScroll);
    setInterval(syncScroll, 10000);
    // fsSource.addEventListener("keydown", e => {
    //     if (e.key === "z" && e.altKey) {
    //         e.preventDefault();
    //         fsDisplay.style.whiteSpace = fsSource.style.whiteSpace = fsSource.style.whiteSpace === "pre" ? "pre-wrap" : "pre";
    //     }
    // });
}

if (document.readyState === "complete") window.addEventListener("load", main); else main();
