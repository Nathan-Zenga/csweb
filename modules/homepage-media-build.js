const fs = require('fs'); // core module
const ytdl = require('ytdl-core');
const { v2: cloud } = require('cloudinary');
const { Homepage_image } = require('../models/models');
const mongoose = require('mongoose');
const { parallel } = require('async');
const build_stage = mongoose.connection.readyState === 0;

const homepage_media_uploader = async () => {
    build_stage && await mongoose.connect(process.env.CSDB);
    const basepath = "./media_temp";
    const media = await Homepage_image.find({ p_id: { $regex: /^homepage\/videos/ } });

    console.log("Clearing media...");
    await cloud.api.delete_resources(media.map(m => m.p_id)).catch(e => e);
    await Homepage_image.deleteMany({ _id: { $in: media.map(m => m.id) } });
    fs.rm(basepath, { recursive: true, force: true }, async err => {
        if (err) { build_stage && await connection.close(); throw err }
        fs.mkdirSync(basepath);

        const urls = ["https://www.youtube.com/watch?v=rCLf32SexXQ", "https://www.youtube.com/watch?v=vSwpZjDuPOM"];
        console.log("Homepage media uploading...");
        await parallel(urls.map((url, i) => cb => {
            const file = `${basepath}/homepage-bg-vid-${i}.mp4`;
            const videoID = ytdl.getURLVideoID(url);
            ytdl.getInfo(videoID).then(info => {
                const filter = fmt => fmt.initRange && fmt.indexRange && fmt.hasVideo && fmt.quality === "medium";
                const format = ytdl.chooseFormat(info.formats, { filter, quality: "highest" });
                const stream = ytdl(url, { format }).pipe(fs.createWriteStream(file));

                stream.on("error", err => { console.error(err.message); cb() });
                stream.on("finish", async () => {
                    const filename = info.videoDetails.title.replace(/\p{Extended_Pictographic}|[ ?&#\\%<>+]/gu, "_");
                    const public_id = "homepage/videos/" + filename;
                    const result = await cloud.uploader.upload(file, { public_id, resource_type: "video" });
                    await Homepage_image.create({ p_id: result.public_id, url: result.secure_url, index: i });
                    cb();
                });
            });
        }));

        fs.rm(basepath, { recursive: true, force: true }, async () => {
            console.log("Done... homepage media uploaded");
            build_stage && await mongoose.connection.close();
        });
    });
};

build_stage ? homepage_media_uploader() : module.exports = homepage_media_uploader;
