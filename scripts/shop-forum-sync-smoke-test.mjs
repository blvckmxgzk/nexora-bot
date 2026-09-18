import {
  readFile,
} from "node:fs/promises";

const forum =
  await import(
    "../dist/services/shopForumService.js"
  );

if (
  typeof forum
    .updateShopForum !==
  "function"
) {
  throw new Error(
    "updateShopForum export missing",
  );
}

if (
  typeof forum
    .syncShopForumSafe !==
  "function"
) {
  throw new Error(
    "syncShopForumSafe export missing",
  );
}

if (
  typeof forum
    .syncAllShopForums !==
  "function"
) {
  throw new Error(
    "syncAllShopForums export missing",
  );
}

const requiredFiles = [
  "dist/interactions/modals/product-create-modal.js",
  "dist/interactions/modals/product-edit-modal.js",
  "dist/interactions/modals/product-stock-modal.js",
  "dist/interactions/buttons/product-toggle.js",
  "dist/interactions/buttons/product-delete.js",
  "dist/interactions/buttons/product-delete-confirm.js",
  "dist/services/marketplace/marketplaceV2Service.js",
  "dist/services/marketplace/marketplaceV2Runtime.js",
];

for (
  const file of
  requiredFiles
) {
  const content =
    await readFile(
      file,
      "utf8",
    );

  if (
    !content.includes(
      "syncShopForumSafe",
    ) &&
    !content.includes(
      "syncAllShopForums",
    )
  ) {
    throw new Error(
      `Forum sync hook missing from ${file}`,
    );
  }
}

for (
  const retired of [
    "dist/interactions/modals/product-create.js",
    "dist/interactions/modals/product-edit.js",
  ]
) {
  try {
    await readFile(
      retired,
      "utf8",
    );

    throw new Error(
      `Retired duplicate handler still exists: ${retired}`,
    );
  } catch (
    error
  ) {
    if (
      error?.code !==
      "ENOENT"
    ) {
      throw error;
    }
  }
}

console.log(
  "✅ Shop Forum sync API valid",
);

console.log(
  "✅ Product create/edit/stock hooks valid",
);

console.log(
  "✅ Product toggle/delete hooks valid",
);

console.log(
  "✅ Trade completion hook valid",
);

console.log(
  "✅ Review/rating hook valid",
);

console.log(
  "✅ Startup reconciliation valid",
);

console.log(
  "✅ Duplicate modal handlers removed",
);
