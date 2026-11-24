/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { buildFormStateHandler } from '@payloadcms/ui/utilities/buildFormState'
import { mayRunEditorLocking } from '@/collections/LockedDocuments'
import React from 'react'

import { importMap } from './admin/importMap.js'
import './custom.css'

type Args = {
  children: React.ReactNode
}

const guardedFormState: typeof buildFormStateHandler = async (args) => {
  const returnLockStatus = args.returnLockStatus && (await mayRunEditorLocking(args.req, args))
  return buildFormStateHandler({ ...args, returnLockStatus })
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
    serverFunctions: { 'form-state': guardedFormState },
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
