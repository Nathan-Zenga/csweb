const fs = require('fs'); // core module
const ytdl = require('ytdl-core');
const { v2: cloud } = require('cloudinary');
const { Homepage_image } = require('../models/models');
const mongoose = require('mongoose');
const { parallel } = require('async');

mongoose.connect(process.env.CSDB).then(async ({ connection }) => {
    const basepath = "./public/media";
    const media = await Homepage_image.find({ p_id: { $regex: /^homepage\/videos/ } });

    await cloud.api.delete_resources(media.map(m => m.p_id)).catch(e => e);
    await Homepage_image.deleteMany({ _id: { $in: media.map(m => m.id) } });
    console.log("Clearing media directory...");
    fs.rm(basepath, { recursive: true, force: true }, async err => {
        if (err) { console.error(err.message); return await connection.close() }
        fs.mkdirSync(basepath);

        const urls = ["https://www.youtube.com/watch?v=rCLf32SexXQ", "https://www.youtube.com/watch?v=vSwpZjDuPOM"];
        await parallel(urls.map((url, i) => cb => {
            const file = `${basepath}/homepage-bg-vid-${i}.mp4`;
            const videoID = ytdl.getURLVideoID(url);
            ytdl.getInfo(videoID).then(info => {
                const filter = fmt => fmt.initRange && fmt.indexRange && fmt.hasVideo && fmt.quality === "medium";
                const format = ytdl.chooseFormat(info.formats, { filter, quality: "highest" });
                const stream = ytdl(url, { format }).pipe(fs.createWriteStream(file));
                console.log("Homepage media uploading...");

                stream.on("error", async err => { console.error(err.message); cb() });
                stream.on("ready", () => { console.log("Piping...") });
                stream.on("finish", async () => {
                    const media = await Homepage_image.find({ p_id: { $regex: /^homepage\/videos/ } });
                    const public_id = `homepage/videos/homepage-bg-vid-${i}`;
                    const result = await cloud.uploader.upload(file, { public_id, resource_type: "video" });
                    await Homepage_image.create({ p_id: result.public_id, url: result.secure_url, index: media.length + 1 });
                    console.log("Done... homepage media uploaded");
                    cb();
                });
            });
        }));

        await connection.close();
    });
});
