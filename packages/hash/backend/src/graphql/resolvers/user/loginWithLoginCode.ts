import { ApolloError } from "apollo-server-express";

import {
  LOGIN_CODE_MAX_AGE,
  LOGIN_CODE_MAX_ATTEMPTS,
} from "../../../auth/passport/PasswordlessStrategy";
import {
  MutationLoginWithLoginCodeArgs,
  Resolver,
  User,
} from "../../apiTypes.gen";
import { GraphQLContext } from "../../context";

export const loginWithLoginCode: Resolver<
  User,
  {},
  GraphQLContext,
  MutationLoginWithLoginCodeArgs
> = async (_, { loginId, ...args }, { dataSources, passport }) => {
  const loginCode = await dataSources.db.getLoginCode({ loginId });

  if (!loginCode)
    throw new ApolloError(
      `A login code with login id '${loginId}' could not be found.`,
      "LOGIN_CODE_NOT_FOUND"
    );

  // If the login code's maximum number of attempts has been exceeded
  if (loginCode.numberOfAttempts >= LOGIN_CODE_MAX_ATTEMPTS)
    throw new ApolloError(
      `The maximum number of attempts for the login code with id '${loginId}' has been exceeded.`,
      "MAX_ATTEMPTS"
    );

  // If the login code has expired
  if (loginCode.createdAt.getTime() < new Date().getTime() - LOGIN_CODE_MAX_AGE)
    throw new ApolloError(
      `The login code with id '${loginId}' has expired.`,
      "EXPIRED"
    );

  // Otherwise, let's check if the provided code matches the login code
  if (loginCode.code === args.loginCode) {
    const user = await dataSources.db
      .getUserById({ id: loginCode.userId })
      .then((user) => {
        if (!user)
          throw new ApolloError(
            `A user with the id '${loginCode.userId}' could not be found.`,
            "USER_NOT_FOUND"
          );
        return user;
      })
      .catch((err) => {
        throw err;
      });

    await passport.login(user, {});

    return user;
  }

  await dataSources.db.incrementLoginCodeAttempts({ loginCode });

  throw new ApolloError(
    `The provided login code does not match the login code with id '${loginId}'.`,
    "INCORRECT"
  );
};
