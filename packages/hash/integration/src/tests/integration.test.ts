import "./loadTestEnv";
import User from "@hashintel/hash-backend/src/model/user.model";
import VerificationCode from "@hashintel/hash-backend/src/model/verificationCode.model";
import { PostgresAdapter } from "@hashintel/hash-backend/src/db";

import { ApiClient } from "./util";
import { IntegrationTestsHandler } from "./setup";
import { PageFieldsFragment, SystemTypeName } from "../graphql/apiTypes.gen";

const ACCOUNT_ID = "00fbb02c-52ee-45bb-b0aa-39c5d44f216e";

const client = new ApiClient("http://localhost:5001/graphql");

let handler: IntegrationTestsHandler;

let db: PostgresAdapter;

beforeAll(async () => {
  handler = new IntegrationTestsHandler();
  await handler.init();
  await handler.createAccount(ACCOUNT_ID);

  db = new PostgresAdapter();
});

afterAll(async () => {
  await handler.close();
  await db.close();
});

it("can create user", async () => {
  const email = "alice@bigco.com";

  const { id: verificationCodeId, createdAt: verificationCodeCreatedAt } =
    await client.createUser({ email });

  const user = (await User.getUserByEmail(db)({
    email,
    verified: false,
    primary: true,
  }))!;

  expect(user).not.toBeNull();
  expect(user.properties).toEqual({
    emails: [{ address: email, primary: true, verified: false }],
  });
  expect(user.entityCreatedAt).toEqual(user.entityVersionUpdatedAt);
  expect(user.entityType.properties.title).toEqual("User");

  const verificationCode = (await VerificationCode.getById(db)({
    id: verificationCodeId,
  }))!;

  expect(verificationCode).not.toBeNull();
  expect(verificationCode.createdAt.toISOString()).toBe(verificationCodeCreatedAt);

  /** @todo: check whether the verification code was sent in an email address */
});

it("can create org", async () => {
  const orgVars = {
    shortname: "bigco",
  };
  const res = await client.createOrg(orgVars);
  expect(res.properties).toEqual(orgVars);
  expect(res.createdAt).toEqual(res.updatedAt);
  expect(res.entityTypeName).toEqual("Org");
});

describe("create and update pages", () => {
  let page: PageFieldsFragment;
  it("can create a page", async () => {
    page = await client.createPage({
      accountId: ACCOUNT_ID,
      properties: {
        title: "My first page",
      },
    });
    return page;
  });

  it("can update the page", async () => {
    const updatedPage = await client.insertBlocksIntoPage({
      accountId: ACCOUNT_ID,
      pageId: page.entityVersionId,
      pageMetadataId: page.metadataId,
      blocks: [
        {
          accountId: ACCOUNT_ID,
          componentId: "https://block.blockprotocol.org/header",
          systemTypeName: SystemTypeName.Text,
          entityProperties: {
            texts: [{ text: "Hello World!" }],
          },
        },
      ],
    });

    expect(updatedPage.metadataId).toEqual(page.metadataId);
    expect(updatedPage.entityVersionId).not.toEqual(page.entityVersionId); // new version
    expect(updatedPage.history).toHaveLength(2);
    expect(updatedPage.history).toEqual([
      {
        createdAt: updatedPage.createdAt,
        entityId: updatedPage.entityVersionId,
      },
      { createdAt: page.createdAt, entityId: page.entityVersionId },
    ]);
    expect(updatedPage.properties.title).toEqual("My first page");

    // We inserted a block at the beginning of the page. The remaining blocks should
    // be the same.
    expect(updatedPage.properties.contents.length).toEqual(
      page.properties.contents.length + 1
    );
    expect(updatedPage.properties.contents.slice(1)).toEqual(
      page.properties.contents
    );
  });

  // @todo: we changed the behavior of GraphQL updates to perform the update on the
  // latest version, even if the ID passed does not match that of the latest version.
  // The test below expects an error on such cases. Return here when the question of
  // optimistic vs. strict entity updates is resolved.
  // it("should throw when updating non-latest version of a page", async () => {
  //   expect.assertions(1);
  //   await expect(
  //     client.insertBlocksIntoPage({
  //       accountId: ACCOUNT_ID,
  //       pageId: page.id,
  //       pageMetadataId: page.metadataId,
  //       blocks: [
  //         {
  //           accountId: ACCOUNT_ID,
  //           componentId: "https://block.blockprotocol.org/header",
  //           entityType: "Text",
  //           entityProperties: {
  //             texts: [{ text: "This will fail" }],
  //           },
  //         },
  //       ],
  //     })
  //   ).rejects.toThrow();
  // });
});
