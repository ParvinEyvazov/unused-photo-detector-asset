import * as Bucket from "@spica-devkit/bucket";
const fetch = require("node-fetch");

const PUBLIC_URL = process.env.__INTERNAL__SPICA__PUBLIC_URL__;
const AUTH_APIKEY = process.env.AUTH_APIKEY;

const title = "Unused Image Detector";
const description = {
  main: "This dashboard helps you to detect and delete unused images in the storage.",
  error_fetch_bucket_scheme: "Error while fetching Bucket Scheme.",
  no_storage_fields_in_bucket:
    "Buckets don't have any storage fields to search for.",
  no_storage_data_using_in_bucket:
    "There is not any storage data that is using in buckets.",
  no_data_in_storage: "There is not any data in the storage.",
  no_data_to_delete: "All data in the storage is in use in bucket datas.",
};

// url finder regex
const regex =
  /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim;

export async function initialize() {
  Bucket.initialize({ apikey: AUTH_APIKEY });

  let bucket_scheme = await Bucket.getAll();

  // console.log(JSON.stringify(bucket_scheme, null, 4));

  // check bucket scheme is valid
  if (!bucket_scheme) {
    return {
      title: title,
      description: description.error_fetch_bucket_scheme,
    };
  }

  // check bucket paths is not empty
  let bucket_paths = getStoragePaths(bucket_scheme);
  if (!bucket_paths) {
    return {
      title: title,
      description: description.no_storage_fields_in_bucket,
      button: {
        color: "primary",
        target: `${PUBLIC_URL}/fn-execute/clean-all-storage-data`,
        method: "get",
        title: "Clean all storage",
      },
    };
  }

  // check if there are storage data in the buckets
  let urls = await getUsedUrls(bucket_paths);
  if (urls.length < 1) {
    return {
      title: title,
      description: description.no_storage_data_using_in_bucket,
      button: {
        color: "primary",
        target: `${PUBLIC_URL}/fn-execute/clean-all-storage-data`,
        method: "get",
        title: "Clean all storage",
      },
    };
  }

  // check if storage is empty or not
  let storage_datas = await getStorageData();
  if (!storage_datas) {
    return {
      title: title,
      description: description.no_data_in_storage,
    };
  }

  // check if there is unused storage data or not
  let unused_storage_datas = detectUnusedStorageData(storage_datas, urls);
  if (unused_storage_datas.length < 1) {
    return {
      title: title,
      description: description.no_data_to_delete,
    };
  }

  return {
    title: title,
    description:
      description.main +
      ` Number of unused images(includes all storage data): ${unused_storage_datas.length}`,
    button: {
      color: "primary",
      target: `${PUBLIC_URL}/fn-execute/clean-unused-storage-data`,
      method: "get",
      title: "Remove unused images",
    },
  };
}

function getStoragePaths(bucket_scheme) {
  let bucket_paths = {};
  let paths = [];
  let path = [];

  bucket_scheme.forEach((item) => {
    function findStorage(props) {
      Object.keys(props).forEach((p) => {
        if (props[p].type == "storage") {
          path.push(p);
          paths.push(path);
          path = [];

          bucket_paths[item._id] = paths;
        }
        if (props[p].type == "object") {
          path.push(p);
          findStorage(props[p].properties);
        }
        if (props[p].type == "array") {
          path.push(p);
          findStorage(props[p]);
        }
      });
    }
    paths = [];
    findStorage(item.properties);
  });

  return bucket_paths;
}

function detectUnusedStorageData(storage_datas, used_urls) {
  let unused_storage_data = storage_datas.filter(
    (storage_data) => JSON.stringify(used_urls).indexOf(storage_data.url) < 1
  );

  return unused_storage_data;
}

async function getUsedUrls(bucket_paths) {
  let urls = [];

  for (const bucket_id in bucket_paths) {
    let temp_bucket_data = await Bucket.data.getAll(bucket_id, {
      queryParams: { filter: {} },
    });

    let bucket_data_string = JSON.stringify(temp_bucket_data);
    const found = bucket_data_string.match(regex);
    if (found) {
      urls = urls.concat(found);
    }
  }

  return urls;
}

async function getStorageData() {
  let storage_datas;

  await fetch(`${PUBLIC_URL}/storage`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `APIKEY ${AUTH_APIKEY}`,
    },
  })
    .then((res) => res.json())
    .then((data) => {
      storage_datas = data.data;
    })
    .catch((error) =>
      console.log("error on fetching data from storage: ", error)
    );

  return storage_datas;
}

export async function cleanAllStorageData(req, res) {
  let storage_datas = await getStorageData();

  let message = await cleanStorage(storage_datas);

  return { message: message };
}

export async function cleanUnusedStorageData(req, res) {
  Bucket.initialize({ apikey: AUTH_APIKEY });

  let bucket_scheme = await Bucket.getAll();
  let bucket_paths = getStoragePaths(bucket_scheme);
  let urls = await getUsedUrls(bucket_paths);
  let storage_datas = await getStorageData();
  let unused_storage_datas = detectUnusedStorageData(storage_datas, urls);

  let message = await cleanStorage(unused_storage_datas);

  return { message: message };
}

async function cleanStorage(storage_datas) {
  console.log("cleanStorage HIT");
  let message = "";

  let promises = [];

  storage_datas.forEach((storage_data) => {
    promises.push(
      fetch(`${PUBLIC_URL}/storage/${storage_data._id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          authorization: `APIKEY ${AUTH_APIKEY}`,
        },
      })
    );
  });

  await Promise.all(promises)
    .then((_) => {
      message = "Successfully completed.";
    })
    .catch((error) => {
      console.log(error);
      message = "Error on removing items.";
    });

  return message;
}
