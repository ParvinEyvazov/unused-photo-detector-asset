import * as Bucket from "@spica-devkit/bucket";

const PUBLIC_URL = process.env.__INTERNAL__SPICA__PUBLIC_URL__;
const AUTH_APIKEY = process.env.AUTH_APIKEY;

export async function initialize() {
  Bucket.initialize({ apikey: AUTH_APIKEY });

  let bucket_scheme = await Bucket.getAll();

//   console.dir("scheme: ", bucket_scheme);
  console.log(JSON.stringify(bucket_scheme, null, 4));


  return {
    title: "Unused Image Detector",
    description: `This dashboard helps you to detect and delete unused images in the storage.`,
    button: {
      color: "primary",
      target: `${PUBLIC_URL}/fn-execute/dashboard-export-execute`,
      method: "get",
      title: "Remove images",
    },
  };
}
