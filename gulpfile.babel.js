const gulp = require("gulp");
const gulpLoadPlugins = require("gulp-load-plugins");
const browserSync = require("browser-sync");
const del = require("del");
const wiredep = require("wiredep").stream;
const npmwiredep = require("npm-wiredep").stream;
const fs = require("fs");
const reload = browserSync.reload;
const clip = require("gulp-clip-empty-files");
const sassGlob = require("gulp-sass-glob");
const runSequence = require("run-sequence");
const colors = require("colors/safe");
const merge = require("merge-stream")
const jsonlint = require("jsonlint");
const $ = gulpLoadPlugins();
const path = require("path");
const jsf = require("json-schema-faker");
const faker = require("faker");
const JSON5 = require("json5");
faker.localce = "pl";

jsf.extend("chance", () => require("chance"));
jsf.extend("faker", () => faker);

var env = "dev";
var _ = {
    app: "app",
    tmp: ".tmp",
    dist: "dist",
    json: "app/json",
    build_to: false
};

var _opt = fs.existsSync("options.json") ?
    JSON5.parse(fs.readFileSync("options.json")) :
    null;

if (_opt && _opt[_.app]) {
    for (var key in _opt[_.app]) _[key] = _opt[_.app][key];
}

gulp.task("styles", () => {
    return gulp
        .src([
            _.app + "/styles/**/*.scss",
            "!" + _.app + "/styles/**/_*.scss",
            "!" + _.app + "/styles/_**/*.scss"
        ])
        .pipe($.plumber())
        .pipe($.sourcemaps.init())
        .pipe(sassGlob())
        .pipe(
            $.sass
                .sync({
                    outputStyle: "compressed",
                    precision: 10,
                    includePaths: ["."]
                })
                .on("error", $.sass.logError)
        )
        .pipe(
            $.autoprefixer({
                browsers: ["> 1%", "ie 10", "last 2 versions", "Safari 8", "Firefox ESR"]
            })
        )
        .pipe($.sourcemaps.write())
        .pipe(gulp.dest(_.tmp + "/styles"))
        .pipe(reload({
            stream: true
        }));
});

gulp.task("scripts", () => {
    return gulp
        .src([
            _.app + "/scripts/**/*.js",
            "!" + _.app + "/scripts/**/_*.js",
            "!" + _.app + "/scripts/_**/*.js"
        ])
        .pipe($.plumber())
        .pipe($.sourcemaps.init())
        .pipe($.babel())
        .pipe($.sourcemaps.write())
        .pipe(gulp.dest(_.tmp + "/scripts"))
        .pipe(reload({
            stream: true
        }));
});

function findAndReplace(refs, object, keyhas) {
    var value;
    Object.keys(object).some(function (k) {
        if (keyhas === k.charAt(0)) {
            value = object[k];
            var ref = object[k].split(":");
            if (refs[ref[0]]) {
                object[k.replace(/^\$/, "")] = refs[ref[0]].slice(0, ref[1]);
                return true;
            }
        }

        if (object[k] && typeof object[k] === "object") {
            value = findAndReplace(refs, object[k], keyhas);
        }
    });
    return value;
}

gulp.task("twig", () => {
    var content = {
        definitions: {},
        global: {},
        page: {}
    };

    fs.readdirSync(_.json).forEach(file => {
        try {
            let _content = JSON5.parse(fs.readFileSync(_.json + "/" + file, "utf8"));

            if (_content._test) {
                var ref = _content._test.split(":");
                var _faker = {};

                try {
                    var _faker = jsf.generate(_content[ref[1]]);
                    _content[ref[0]] = Object.assign({}, _content[ref[0]], _faker);
                } catch (e) {
                    console.log(colors.red(e.name), e.message);
                }
            }

            if (_content.in_file) {
                content.page[_content.in_file] = _content;
            } else if (_content._definitions) {
                content.definitions = _content._definitions;
            } else {
                content.global = Object.assign(content.global, _content);
            }
        } catch (e) {
            console.log(e.message, "in", colors.cyan(file));
        }


        findAndReplace(content.definitions, content.global, "$");
        findAndReplace(content.definitions, content.page, "$");

    });
    console.log(content.definitions);


    return gulp
        .src([
            _.app + "/**/*.twig",
            "!" + _.app + "/**/_*.twig",
            "!" + _.app + "/_**/*.twig"
        ])
        .pipe($.plumber())
        .pipe($.data(function (_file) {
            var page = {};
            _file = path.basename(_file.path);

            if (content.page[_file])
                page = content.page[_file];

            return Object.assign(content.global, page);
        }))
        .pipe(
            $.twig({
                base: _.app + "/",
                rethrow: true,
                filters: [{
                    name: "clone",
                    func: value => {
                        return JSON5.parse(JSON5.stringify(value));
                    }
                }, {
                    name: "resize",
                    func: (image, data) => {
                        return image + "?s=" + data[0] + "x" + data[1];
                    }
                },
                    {
                        name: "tel",
                        func: (string) => {
                            return string.replace(/\D/g, "");
                        }
                    },
                    {
                        name: "target",
                        func: (obj) => {
                            if (obj.target)
                                return "target=\"" + obj.target + "\"";
                            return "";
                        }
                    },
                    {
                        name: "parse",
                        func: (string, data) => {
                            var _class = data[0];
                            string = string.replace(/\*\*(.+?)\*\*/g, "<span" + (_class ? " class=\"" + _class +
                                "\"" : "") +
                                ">$1</span>");
                            string = string.replace(/\-\-(.+?)\-\-/g, "<small>$1</small>");
                            return string;
                        }
                    },
                    {
                        name: "get_embed",
                        func: (value) => {
                            var res = /src="(.+?)"/g.exec(value);
                            return res[1];
                        }
                    },
                    {
                        name: "truncate",
                        func: (value, data) => {
                            var words = value.split(" ");
                            var count = 0;
                            var dots = words.length <= data[0] ? "" : "...";
                            return words.filter(function (word) {
                                ++count;
                                return count <= data[0];
                            }).join(" ") + dots;
                        }
                    }
                ],
                functions: [{
                    name: "reorder",
                    func: (array, order) => {
                        let result = [];
                        for (var i = 0, j = array.length; i < j; i++)
                            result[i] = array[order[i]];
                        return result;
                    }
                },
                    {
                        name: "function",
                        func: (param) => {
                            return "";
                        }
                    },
                    {
                        name: "__",
                        func: (translate, translate_id) => {
                            return translate;
                        }
                    }
                ]
            })
        )
        .on("error", function (error) {
            this.emit("end");
        })
        .pipe(gulp.dest(_.tmp))
        .pipe(reload({
            stream: true,
            once: true
        }));
});

gulp.task("html", ["styles", "scripts"], () => {
    return gulp
        .src([_.tmp + "/**/*.html"])
        .pipe($.useref({
            searchPath: [_.app, _.tmp, "."]
        }))
        .pipe(gulp.dest(_.dist));
});

gulp.task("images", () => {
    var images = gulp.src(_.app + "/images/**/*").pipe(gulp.dest(_.dist + "/images"));
    var svg = gulp.src(_.app + "/svg/**/*").pipe(gulp.dest(_.dist + "/svg"));

    return merge(images, svg);
});

gulp.task("fonts", () => {
    return gulp
        .src(
            require("main-bower-files")("**/*.{eot,svg,ttf,woff,woff2}", function (
                err
            ) {
            }).concat(_.app + "/fonts/**/*")
        )
        .pipe(gulp.dest(_.tmp + "/fonts"))
        .pipe(gulp.dest(_.dist + "/fonts"));
});

gulp.task("extras", () => {
    return gulp
        .src([_.app + "/*.*", "!" + _.app + "/*.html", "!" + _.app + "/*.twig"], {
            dot: true
        })
        .pipe(gulp.dest(_.dist));
});

gulp.task("clean", () => {
    return del(_.dist);
});

gulp.task("serve", ["styles", "scripts", "fonts", "twig"], () => {
    browserSync({
        notify: false,
        port: 9000,
        server: {
            baseDir: [_.tmp, _.app],
            routes: {
                "/bower_components": "bower_components",
                "/node_modules": "node_modules"
            }
        }
    });

    gulp
        .watch([_.app + "/images/**/*", _.tmp + "/fonts/**/*"])
        .on("change", reload);
    gulp.watch([_.app + "/**/*.twig", _.json + "/*"], ["twig"]);
    gulp.watch(_.app + "/styles/**/*.scss", ["styles"]);
    gulp.watch(_.app + "/scripts/**/*.js", ["scripts"]);
    gulp.watch(_.app + "/fonts/**/*", ["fonts"]);
    gulp.watch(_.app + "/images/**/*", ["images"]);
    gulp.watch(["bower.json", "package.json"], ["wiredep", "fonts"]);
    // gulp.watch('package.json', ['updateopt']);
});

gulp.task("serve:dist", ["styles", "scripts", "fonts", "twig"], () => {
    browserSync({
        notify: false,
        port: 3000,
        server: {
            baseDir: ["dist"]
        }
    });
});

gulp.task("post-buildto", () => {
    if (_.build_to != false) {
        _.build_to.dir.forEach(dir => {
            return gulp.src(_.dist + "/" + dir + "/**/*")
                .pipe(gulp.dest(_.build_to.path + "/" + dir))
                .pipe(
                    $.size({
                        title: "build to " + _.build_to.path + "/" + dir + " end",
                        gzip: true
                    })
                );
        });
    }
});

gulp.task("wiredep", () => {
    return gulp
        .src([_.app + "/**/*.html", _.app + "/**/*.twig", _.app + "/**/*.scss"])
        .pipe(clip())
        .pipe(
            wiredep({
                ignorePath: /^(\.\.\/)*\.\./,
                fileTypes: {
                    scss: {
                        replace: {
                            css: function (filePath) {
                                return "@import \"../.." + filePath.replace(/\.css$/, "") + "\";";
                            },
                            scss: "@import \"../..{{filePath}}\";"
                        }
                    }
                }
            })
        ).pipe(
            npmwiredep({
                directory: "node_modules",
                ignorePath: /^(\.\.\/)*\.\./,
                fileTypes: {
                    scss: {
                        replace: {
                            css: function (filePath) {
                                return "@import \"../.." + filePath.replace(/\.css$/, "") + "\";";
                            },
                            scss: "@import \"../..{{filePath}}\";"
                        }
                    }
                }
            })
        )
        .pipe(gulp.dest(_.app));
});

gulp.task("build", () => {
    return new Promise(resolve => {
        env = "build";
        runSequence(["clean", "wiredep", "twig", "html"], "post-build", resolve);
    });
});

gulp.task("buildto", () => {
    return new Promise(resolve => {
        runSequence(["build"], "post-buildto", resolve);
    });
});

gulp.task("post-build", ["images", "fonts", "extras"], () => {
    const sizeOfStyles = $.size({
        gzip: true,
        showTotal: false
    });
    const sizeOfScripts = $.size({
        gzip: true,
        showTotal: false
    });

    return gulp
        .src(_.dist + "/**/*")
        .pipe($.if("*.js", $.uglify({
            compress: {
                drop_console: true
            }
        })))
        .pipe($.if("*.css", $.cssnano({
            safe: true,
            autoprefixer: false,
            discardComments: {
                removeAll: true
            }
        })))
        .pipe(gulp.dest(_.dist))
        .pipe($.if("*.js", sizeOfScripts))
        .pipe($.if("*.css", sizeOfStyles))
        .pipe($.notify({
            onLast: true,
            title: "Build complete",
            message: () => `\nSize (gzip) of \nscripts - ${sizeOfScripts.prettySize}\nstyles - ${sizeOfStyles.prettySize}`
        }));
});

gulp.task("post-buildto", () => {
    return gulp
        .src(_.dist + "/**/*")
        .pipe($.if(_.build_to.dir, gulp.dest(_.build_to.path)))
        .pipe($.notify({
            onLast: true,
            title: "Build to complete",
            message: () => ``
        }));
});

gulp.task("default", ["clean"], () => {
    gulp.start("serve");
});
