import { ApolloError, useMutation } from "@apollo/client";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { ParsedUrlQueryInput } from "querystring";
import { useEffect, useState } from "react";
import { tw } from "twind";
import {
  LoginCodeMetadata,
  Mutation,
  MutationLoginWithLoginCodeArgs,
  SendLoginCodeMutationVariables,
} from "../graphql/apiTypes.gen";
import {
  sendLoginCode as sendLoginCodeMutation,
  loginWithLoginCode as loginWithLoginCodeMutation,
} from "../graphql/queries/user.queries";

type ParsedLoginQuery = {
  loginId: string;
  loginCode: string;
};

const tbdIsParsedLoginQuery = (
  tbd: ParsedUrlQueryInput
): tbd is ParsedLoginQuery =>
  tbd.loginId !== undefined &&
  typeof tbd.loginId === "string" &&
  tbd.loginCode !== undefined &&
  typeof tbd.loginCode === "string";

const LoginPage: NextPage = () => {
  const router = useRouter();

  const [emailOrShortname, setEmailOrShortname] = useState<string>("");

  const [loginCode, setLoginCode] = useState<string>("");
  const [loginCodeMetadata, setLoginCodeMetadata] =
    useState<LoginCodeMetadata | undefined>();

  const [
    sendLoginCode,
    { loading: sendLoginCodeLoading, error: sendLoginCodeError },
  ] = useMutation<Mutation, SendLoginCodeMutationVariables>(
    sendLoginCodeMutation,
    {
      onCompleted: (data) => {
        setLoginCodeMetadata(data?.sendLoginCode);
      },
    }
  );

  const [loginWithLoginCode, { loading: loginWithLoginCodeLoading }] =
    useMutation<Mutation, MutationLoginWithLoginCodeArgs>(
      loginWithLoginCodeMutation,
      {
        onCompleted: ({ loginWithLoginCode }) => {
          const user = loginWithLoginCode;
          console.log(user);
        },
        onError: ({ graphQLErrors }) =>
          graphQLErrors.forEach(({ extensions }) => {
            const { code } = extensions as { code?: string };
            // @todo: account for possible error conditions
            if (code === "LOGIN_CODE_NOT_FOUND") {
            } else if (code === "MAX_ATTEMPTS") {
            } else if (code === "EXPIRED") {
            } else if (code === "INCORRECT") {
            } else {
              throw new ApolloError({ graphQLErrors });
            }
          }),
      }
    );

  useEffect(() => {
    const { query } = router;

    if (tbdIsParsedLoginQuery(query)) {
      const { loginId, loginCode } = query;
      loginWithLoginCode({ variables: { loginId, loginCode } });
    }
  }, [router, loginWithLoginCode]);

  const reset = () => {
    setEmailOrShortname("");
    setLoginCode("");
    setLoginCodeMetadata(undefined);
  };

  const emailOrShortnameIsValid = emailOrShortname !== "";

  const loginCodeIsValid = loginCode !== "";

  return (
    <div
      className={tw(
        "container mx-auto px-4 h-full",
        "flex flex-col items-center justify-center"
      )}
    >
      <div
        className={tw(
          "flex flex-col",
          "bg-white space-y-3 p-3 rounded-lg shadow-lg border"
        )}
      >
        <label className={tw`block text-gray-700 text-sm font-bold mb-2`}>
          Email or Shortname
          <input
            className={tw`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
            type="text"
            value={emailOrShortname}
            onChange={({ target }) => setEmailOrShortname(target.value)}
            placeholder="Enter your email or shortname to continue"
            disabled={loginCodeMetadata !== undefined}
          />
        </label>
        {loginCodeMetadata ? (
          <>
            <p>Please check your inbox for a temporary login code</p>
            <label className={tw`block text-gray-700 text-sm font-bold mb-2`}>
              Login Code
              <input
                className={tw`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
                type="text"
                value={loginCode}
                onChange={({ target }) => setLoginCode(target.value)}
                placeholder="Paste your login code"
                disabled={loginWithLoginCodeLoading}
              />
            </label>
            <div className={tw`flex justify-between`}>
              <button
                className={tw`flex-grow mr-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded`}
                onClick={reset}
              >
                Cancel
              </button>
              <button
                className={tw`flex-grow ml-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded`}
                disabled={loginWithLoginCodeLoading || !loginCodeIsValid}
                onClick={() =>
                  loginWithLoginCode({
                    variables: {
                      loginId: loginCodeMetadata.id,
                      loginCode,
                    },
                  })
                }
              >
                Login
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              className={tw`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded`}
              disabled={sendLoginCodeLoading || !emailOrShortnameIsValid}
              onClick={() => sendLoginCode({ variables: { emailOrShortname } })}
            >
              Submit
            </button>
            {sendLoginCodeError && <p>{sendLoginCodeError.message}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
