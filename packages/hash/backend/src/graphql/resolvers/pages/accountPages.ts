import {
  QueryAccountPagesArgs,
  Resolver,
  Visibility,
} from "../../apiTypes.gen";
import { DbPage } from "../../../types/dbTypes";
import { GraphQLContext } from "../../context";

export const accountPages: Resolver<
  Promise<DbPage[]>,
  {},
  GraphQLContext,
  QueryAccountPagesArgs
> = async (_, { accountId }, { dataSources }) => {
  const pages = await dataSources.db.getEntitiesByType({
    accountId,
    type: "Page",
    latestOnly: true,
  });
  return pages.map((page) => ({
    ...page,
    id: page.entityId,
    accountId: page.accountId,
    visibility: Visibility.Public, // TODO: get from entity metadata
  })) as DbPage[];
};
