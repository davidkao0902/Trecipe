import _ from 'lodash';
import { RootState } from '../index';

export const createErrorMessageSelector = (actions: Array<string>) => (state: RootState) => {
    // returns the first error messages for actions
    // * We assume when any request fails on a page that
    //   requires multiple API calls, we shows the first error
    return (
        _(actions)
            .map((action) => _.get(state.error, action))
            .compact()
            .first() || ''
    );
};
