#!/bin/bash

# Copyright © 2016 Jeffery Harrell <jefferyharrell@gmail.com>
# See file 'LICENSE' for use and warranty information.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

###############################################################################

SCRIPTPATH=$(dirname $(realpath $0))
SCHEMATA=( 89dhcp.ldif )
UPDATES=( 89dhcp.update )
IPALIB_PLUGINS=( dhcp.py )
UI_PLUGINS=( dhcp )

###############################################################################

INSTALL=/usr/bin/install

SCHEMA_DEST=/usr/share/ipa/updates

echo ''
echo 'Installing schemata...'

for schema in ${SCHEMATA[@]}; do
    ${INSTALL} -v -o root -g root -m 644 ${SCRIPTPATH}/schema/${schema} ${SCHEMA_DEST}
done

###############################################################################

UPDATE_DEST=/usr/share/ipa/updates

echo ''
echo 'Installing update files...'

for update in ${UPDATES[@]}; do
    ${INSTALL} -v -o root -g root -m 644 ${SCRIPTPATH}/update/${update} ${UPDATE_DEST}
done

###############################################################################

IPALIB_DEST=/usr/lib/python2.7/site-packages/ipalib/plugins/

echo ''
echo 'Installing IPALIB plugins...'

for plugin in ${IPALIB_PLUGINS[@]}; do
    ${INSTALL} -v -o root -g root -m 644 ${SCRIPTPATH}/ipalib/${plugin} ${IPALIB_DEST}
done

###############################################################################

UI_DEST=/usr/share/ipa/ui/js/plugins

echo ''
echo 'Installing UI plugins...'

for plugin in ${UI_PLUGINS[@]}; do
    PLUGIN_FILES=$( ls ${SCRIPTPATH}/ui/${plugin} )
    for file in ${PLUGIN_FILES[@]}; do
        ${INSTALL} -v -o root -g root -m 755 -d ${UI_DEST}/${plugin}
        ${INSTALL} -v -o root -g root -m 644 -t ${UI_DEST}/${plugin} ${SCRIPTPATH}/ui/${plugin}/${file}
    done
done

###############################################################################

echo ''
echo 'Running ipa-ldap-updater.'
for schema in ${SCHEMATA[@]}; do
    /usr/sbin/ipa-ldap-updater --schema-file=${SCHEMA_DEST}/${schema}
done

###############################################################################

echo ''
echo 'Restarting Apache.'
/usr/sbin/apachectl graceful

###############################################################################
